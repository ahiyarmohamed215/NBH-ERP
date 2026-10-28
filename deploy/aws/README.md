# AWS backend production deployment

This directory prepares the existing backend for a single EC2 instance behind NGINX.
Nothing here connects to AWS automatically. Activate the Spring profile with
`SPRING_PROFILES_ACTIVE=prod`; no Maven profile is necessary. Local `application.yml`
and existing migration bytes are unchanged.

## Required environment and TLS

Copy `erp.env.example` to `/etc/nbh-erp/erp.env` on EC2, outside the checkout, and
replace every active placeholder. Spring does not automatically load `.env` files.
The supplied service uses systemd `EnvironmentFile`; protect the real file with
mode 0600 and directory permissions appropriate to its administrator. Never commit
the populated file. Quote values according to systemd EnvironmentFile syntax.

- `RDS_HOST`: actual RDS DNS endpoint (no scheme, port, or IP substitution).
- `RDS_PORT`: normally 3306; omit to use that default.
- `DB_NAME`: `nbh_erp`, already created; automatic database creation is disabled.
- `DB_USERNAME` / `DB_PASSWORD`: runtime account `nbh_erp_app` and its rotated secret.
- `FLYWAY_USERNAME` / `FLYWAY_PASSWORD`: `nbh_erp_migrator` and its separate secret.
- `DB_SSL_TRUSTSTORE_URL`: a file URL, for example
  `file:/etc/nbh-erp/rds-ca.p12`, readable by the service user.
- `DB_SSL_TRUSTSTORE_PASSWORD`: password for that PKCS12 truststore.
- `JWT_SECRET`: independently generated Base64 key, at least 32 decoded random bytes.
- `CORS_ALLOWED_ORIGINS`: exact HTTPS origin(s), comma-separated, no trailing slash
  or wildcard. Same-origin frontend and API hosting is the intended configuration.

Obtain the current CA bundle for your RDS instance from AWS's official TLS guide:
https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
Verify the selected CA against the instance configuration. Import the applicable
PEM certificates individually into a PKCS12 truststore using `keytool -importcert`
with distinct aliases. Let keytool prompt for the password; do not put it in shell
history. An AWS PEM bundle itself is not a PKCS12 truststore. Arrange CA renewal
before certificates expire and deploy the updated truststore before RDS CA changes.

Both datasources enforce `sslMode=VERIFY_IDENTITY`, use the same explicit truststore,
and disable fallback to system trust. TLS verifies both certificate trust and the RDS
hostname. Truststore passwords are supplied as JDBC properties, not URL parameters.
Do not bypass verification or enable public-key retrieval to work around TLS errors.
The URL is composed by the prod profile; `DB_URL` is intentionally not used there.

## Runtime policy

- Loopback `127.0.0.1:8080`; EC2 security groups must also keep 8080 private.
- Native forwarded-header handling trusts loopback only. NGINX must overwrite Host,
  X-Forwarded-For, X-Forwarded-Proto and X-Forwarded-Port appropriately. Do not expose
  a second direct path to the backend.
- Hibernate validates; Flyway creates/upgrades schema using its separate credentials.
- Flyway is enabled, baseline disabled, validation enabled, clean disabled, and
  out-of-order migrations disabled. Do not baseline the empty database at V1.
- Runtime Hikari pool defaults to max 10 / min idle 2. Tune using actual EC2/RDS
  capacity; Flyway may also open startup connections outside this pool.
- Pool acquisition timeout 5s, validation timeout 2s, idle timeout 5m, lifetime 20m,
  keepalive 2m. JDBC TCP connect timeout 5s; socket read timeout defaults to 60s
  (`DB_SOCKET_TIMEOUT_MS`). Check long report requirements before lowering it.
- Console INFO logging, SQL and bind logging disabled. Configure journald retention
  and monitoring on EC2. Existing application logs can contain user identifiers.
- Graceful shutdown allows 30s; systemd allows 45s. SSE streams may be interrupted
  at the shutdown deadline and the existing frontend reconnects.
- Secure HttpOnly refresh cookie on `/api/v1/auth`, SameSite=Lax; existing JWT
  expiry, rotation, revocation, CORS, CSRF-origin/custom-header checks and fixed
  backend 30-minute idle policy remain unchanged. Proxy cookies and auth paths
  without rewriting them. Keep the public HTTPS origin in the CORS allowlist.

Spring command-line arguments and direct `SPRING_*` environment properties still
have normal precedence. Do not use them to override the profile's TLS, schema,
cookie or loopback policy. An optional `SPRING_PROFILES_ACTIVE` entry in a file
does nothing until systemd (or another launcher) actually loads that file.

## Privileges and migration readiness

The runtime account needs SELECT, INSERT, UPDATE, DELETE on `nbh_erp`.*.
The inspected migrations require SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER,
INDEX, REFERENCES on that schema for the migration account. No inspected script
requires DROP TABLE, SUPER, FILE, CREATE ROUTINE, EXECUTE or GRANT OPTION.
Do not grant DDL to the runtime user. DataInitializer's legacy conditional ALTER
attempts are unnecessary on the fresh schema and already ignore permission failures.

There are 53 versions: 51 SQL files under `src/main/resources/db/migration` and
Java migrations V2 and V16 under `src/main/java/db/migration`. Package both kinds.
SQL migrations create 57 application tables; all mapped entity, join, and collection
tables have creation statements. This is static coverage, not a successful MySQL run.

Fresh-MySQL review found no definite invalid MySQL 8.4 statement, but these paths
need a rehearsal on a disposable MySQL 8.4.10 schema before production:

- V1 creates the base tables, indexes and foreign keys. V2 uses JDBC metadata and
  the V1 resource; V16 skips the fresh schema's absent legacy PO `version` column.
- V6/V8 use MySQL session variables, PREPARE/EXECUTE and information_schema checks;
  H2 tests do not establish their MySQL behavior.
- V22/V26/V51 modify columns, including foreign-key columns. Verify them under
  the target server's actual SQL mode and constraint behavior.
- V38 expects V1's `uk_prod_user_wh` index; it creates a replacement product index
  before dropping the uniqueness index. Do not skip preceding versions.
- V48 expects V10's brand markup column, copies data and drops that column.
- V4 deletes retired permissions; V17/V18/V20/V31/V37/V39 and other migrations
  transform existing values. These are especially relevant to later data imports.
- V45-V53 were initially untracked in this working tree; they must be staged and
  committed with their corresponding source changes before building from Git.

Migration contents/checksums must not be edited after deployment. MySQL DDL may
commit independently; a failed migration can leave partial changes. Diagnose the
actual state before retrying or considering Flyway repair. Do not blindly repair,
baseline, clean, or recreate the production schema.

The managed Connector/J 9.7.0 supports MySQL 8.0 and later:
https://dev.mysql.com/doc/relnotes/connector-j/en/news-9-7-0.html
The existing Flyway MySQL module is present. A successful build does not prove
RDS TLS, grants, migration execution, or Hibernate schema validation at runtime.

## Build, release, and first startup

1. Review and commit the complete intended source, including currently untracked
   dependencies and all migrations. Do not deploy a partial Git snapshot.
2. On a build machine with JDK 21, build with `./mvnw -DskipTests package` (Windows:
   `mvnw.cmd -DskipTests package`). This compiles tests but does not execute them.
   Do not run a full test suite pointed at RDS; some tests explicitly run migrations.
3. Run the production configuration binding test separately if desired:
   `./mvnw -Dtest=ProductionConfigurationTest test`. It creates no application
   context, connection pool, network connection, or Flyway instance.
4. Rehearse migrations and Hibernate validation only against a separately authorized
   disposable MySQL 8.4.10 database. Verify rerunning startup has no pending migrations.
5. On EC2 create the dedicated `erp` service user and `/opt/erp`, install the jar as
   `/opt/erp/nbh-erp.jar`, install the populated environment file and CA truststore.
6. Adapt `nbh-erp.service` to the actual memory budget, then install it under
   `/etc/systemd/system/`. It requires no local MySQL service. The initial 512MB heap
   is a starting point; large reports may need more memory. Reload systemd after changes.
7. Configure NGINX TLS using `deploy/aws/nginx.conf`. Preserve the API
   URI, forward headers and Set-Cookie. Keep SSE buffering off. The AWS
   NGINX template needs the real domain/certificates/static asset paths; its separate
   `/assets/` alias must be populated if retained. `/health/` (live and ready probes)
   is proxied directly to the Spring Boot backend for load balancer health checks.
8. Before the first authorized production startup, establish RDS backups and a
   recovery procedure. Starting this prod service automatically runs migrations.
9. For an empty ERP, optionally enable INITIAL_ADMIN_ENABLED and supply the initial
   username/password/email for that first startup. Verify the account, then set
   INITIAL_ADMIN_ENABLED=false, remove the bootstrap password and restart. Existing
   initialization still seeds missing roles/permissions and default vehicles/routes.
   Bootstrap requires an empty users table (including inactive/deleted accounts),
   the registration password policy and a minimum of 12 characters. Existing users
   are never reactivated/promoted and existing role grants are never restored on startup.
10. Check `http://127.0.0.1:8080/health/ready` locally on EC2; verify public HTTPS
    login, refresh, logout, idle behavior, permissions, SSE and representative ERP
    transactions. An SPA HTML response is not a backend health response.

No AWS connection or database migration was performed while preparing these files.
