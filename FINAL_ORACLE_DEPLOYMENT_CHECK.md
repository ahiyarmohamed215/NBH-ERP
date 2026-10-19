# FINAL ORACLE CLOUD DEPLOYMENT VERIFICATION & SAFETY AUDIT (TASK 10B)

**Date:** October 19, 2026  
**Final Status:** CERTIFIED READY FOR DEPLOYMENT  
**Target Environment:** Oracle Cloud Infrastructure (OCI) Always Free  
**Compute Instance:** `VM.Standard.A1.Flex` (Ampere Altra ARM64) — 2 OCPUs, 12 GB RAM, 50 GB NVMe Boot Volume  
**Deployment Verdict:** **PASSED ALL SAFETY & ARCHITECTURAL CHECKS**  

---

## 1. Executive Summary & Deployment Verdict

All architectural audits, resource limits, authentication mechanisms, rollback routines, and deployment configurations have been verified for **NBH ERP** on **Oracle Cloud Infrastructure (OCI) Always Free**.

### Deployment Readiness Verdict
> [!IMPORTANT]
> **VERDICT: 100% READY FOR MANUAL DEPLOYMENT**  
> All deployment scripts, NGINX configurations, systemd services, and database maintenance scripts have been audited, corrected, and locally tested. No connections to Oracle Cloud were established, no live cloud resources were altered, and no business logic was changed.

---

## 2. Accurate Always Free Resource Usage & Headroom Corrections

### Current Official OCI Always Free Limits
Under Oracle's current Free Tier policy for Always Free accounts:
- **Ampere A1 Compute:** Up to **2 OCPUs** and **12 GB RAM** total for continuous usage per tenancy.
- **Storage:** Up to **200 GB eligible aggregate block/boot storage** (shared across all boot and block volumes), subject to account and service limits.
- **Outbound Data Transfer:** Up to **10 TB / month** free outbound data transfer.
- **Public IP:** 1 Ephemeral or Reserved IPv4 address.

### Tenancy Utilization
- **Instance Allocation:** 2 OCPUs (4 vCPUs), 12 GB RAM, 50 GB Boot Volume.
- **Continuous Ampere Compute Utilization:** **100%** of your continuous free Ampere compute quota.
- **Correction Made:** Removed all outdated claims that a 2-OCPU / 12-GB RAM instance leaves another 2 OCPUs and 12 GB RAM free. Under current continuous usage rules, this instance consumes the full continuous Ampere allocation.
- **Provisioning Advisory:** Verify actual Oracle account eligibility and Ampere A1 capacity in your tenancy's home region during manual provisioning, as Ampere A1 availability varies by availability domain (AD).

### Host Memory Budget Partitioning (12 GB Total RAM)
```
+--------------------------------------------------------------------------------+
|                             TOTAL HOST RAM: 12.0 GB                            |
+-------------------+-----------------------+--------------------+---------------+
|  Spring Boot JVM  |        MySQL 8        |     OS & NGINX     | Free Headroom |
|      5.0 GB       |        3.5 GB         |       2.0 GB       |    1.5 GB     |
| (Heap: 3-4G, Meta)| (Buffer Pool: 2560MB) | (Kernel/Cache/Log) | (OOM Buffer)  |
+-------------------+-----------------------+--------------------+---------------+
```

---

## 3. Preserved Authentication & 30-Minute Session Policy

The ERP strictly enforces the **30-minute idle inactivity timeout** and **30-minute refresh-token lifespan**:

| Setting | Production Value | Implementation & Verification |
| :--- | :--- | :--- |
| **Access Token Lifetime** | **15 minutes** (`900,000 ms`) | Preserved in JavaScript browser memory only; never stored on disk. |
| **Refresh Token Lifetime** | **30 minutes** (`1,800,000 ms`) | Transferred via HttpOnly, Secure, SameSite=Lax cookie (`nbh_refresh_token`) scoped to `/api/v1/auth`. |
| **Cookie Max-Age** | **30 minutes** (`1,800 s`) | Reset dynamically to `1,800,000 ms` on every login and token rotation. |
| **Client Inactivity Timeout** | **30 minutes** (`1,800,000 ms`) | Enforced by `IDLE_TIMEOUT_MS` in `frontend/src/api/apiClient.js`. Tracks genuine mouse, keyboard, touch, and scroll interactions. |
| **Server Session Expiration** | **30 minutes** (`1,800,000 ms`) | Session table `expiresAt` in MySQL; revoked immediately on logout. |
| **Sliding Expiration on Activity** | **Active Protection** | As long as an employee actively uses the ERP, the client rotates the token at ~14.5 minutes, sliding the server session forward another 30 minutes. **Active employees are never logged out unexpectedly.** |
| **Background Request Isolation** | **Strict Separation** | Automated background requests (SSE heartbeats, TanStack Query background refetches, and periodic timer checks) do **not** invoke `recordUserActivity()`. Inactivity detection is completely immune to background network activity. |
| **Idle Logout & Cleanup** | **Immediate Wipe** | On 30-minute idle expiration, the client triggers `logout(true)`, deletes the backend session, clears in-memory tokens, purges the TanStack Query and API caches, disconnects SSE, redirects to login, displays the expiration message, and broadcasts `LOGOUT` to all open browser tabs via `BroadcastChannel('nbh_auth_bus')`. |

---

## 4. Frontend Deployment Safety (Zero 404 ChunkLoadErrors)

### The Problem in Standard SPA Deployments
When a new Vite build is deployed with `rm -rf /var/www/erp/dist/*`, active browser sessions with older `index.html` loaded in memory immediately fail with `404 Not Found` (ChunkLoadError) when opening a lazily loaded modal or navigating between views, potentially destroying unsaved invoices or customer forms.

### Implemented Safety Architecture
1. **Cumulative Content-Hashed Assets Pool (`/var/www/erp/assets/`):**
   Vite chunk filenames contain content hashes (e.g. `InvoicingHub-Bs3CT0DS.js`). Because content hashes are unique and immutable, chunks across multiple releases never collide. During deployment, new chunks are copied into `/var/www/erp/assets/` without deleting existing chunks.
2. **Versioned Release Directories (`/var/www/erp/releases/release_<timestamp>/`):**
   Each frontend release is deployed to a clean, isolated directory.
3. **Atomic Symlink Switching (`/var/www/erp/current`):**
   NGINX serves the root from `/var/www/erp/current` (an atomic symlink pointing to the active release) and serves `/assets/` via `alias /var/www/erp/assets/;`.
4. **Zero Interruption for Unsaved Forms:**
   Existing tabs continue to fetch their previous chunks seamlessly from `/var/www/erp/assets/`. Unsaved invoice forms, drafts, and customer edits are never crashed. Newly opened tabs receive the new `index.html` (which has `Cache-Control: no-cache, no-store`).
5. **Instant Rollback:**
   If a frontend release must be rolled back, `ln -sfn /var/www/erp/releases/release_<previous> /var/www/erp/current` instantly restores the matching frontend release.

---

## 5. Backend Rollback Safety & Flyway Schema Awareness

### The Danger of Blind JAR Rollbacks
Spring Boot starts with Flyway enabled. If a new deployment applies database migrations (e.g. `V39` or `V40`) that alter or drop columns, and the application subsequently fails its health check, **blindly rolling back the JAR alone is dangerous**. The older JAR code will execute against a newer database schema, resulting in fatal entity-schema mapping exceptions or silent data corruption.

### Implemented Safety Architecture in `deploy-update.sh`
1. **Pre-Deployment Flyway Version Check:**
   Before updating, the script queries MySQL for the current schema version:
   ```bash
   FLYWAY_BEFORE=$(mysql ... -sN -e "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;")
   ```
2. **Mandatory Pre-Deployment Database Snapshot:**
   An atomic, compressed, and encrypted database snapshot (`nbhdb_pre_deploy_v${FLYWAY_BEFORE}_*.sql.gz.enc`) is created before touching the JAR.
3. **Post-Restart Health Check & Smart Dual-Branch Rollback:**
   The script polls `/api/v1/auth/csrf` for up to 60 seconds:
   - **Scenario A (No migrations ran):** If the new JAR failed to start and `FLYWAY_CURRENT == FLYWAY_BEFORE`, the script automatically rolls back the JAR (`mv nbh-erp.jar.bak nbh-erp.jar`), restores the frontend symlink, and restarts the service safely.
   - **Scenario B (Migrations ran):** If `FLYWAY_CURRENT != FLYWAY_BEFORE`, the script detects that database migrations mutated the schema. It **inhibits blind JAR rollback**, stops the service, alerts the administrator, and provides the exact command for a synchronized full rollback:
     ```bash
     sudo /opt/erp/scripts/rollback-full.sh pre_deploy_v${FLYWAY_BEFORE}
     ```
     `rollback-full.sh` stops the service, decrypts and restores the pre-deployment database snapshot, restores the previous JAR, points the frontend symlink to the matching release, and restarts the service.
4. **Documented Maintenance Windows:**
   - **Routine Releases (Patch/Minor):** Minimal-downtime rolling update (5–15 seconds backend service restart).
   - **Major / Schema-Breaking Releases:** Scheduled 15–30 minute maintenance window with NGINX 503 maintenance page.

---

## 6. Database Backup Safety & Restoration Verification

1. **Encrypted Backups at Rest:**
   Local database backups are encrypted symmetrically using OpenSSL AES-256-CBC with PBKDF2 (100,000 iterations) using a 32-byte secret key stored at `/opt/erp/config/.backup_key` (`chmod 600`, owned by `root:root`). Unencrypted temporary dumps are immediately removed.
2. **No Automatic Paid Oracle Services:**
   Backups are self-contained on the VM with a 14-day local retention policy. An optional off-server transfer hook (`/opt/erp/config/offserver_backup.env`) allows syncing encrypted `.enc` files via SSH/SCP/rsync to an administrator's server without enabling paid cloud features.
3. **Automated Restoration Verification Drill (`verify-backup.sh`):**
   A dedicated drill script `/opt/erp/scripts/verify-backup.sh` decrypts the latest backup, verifies the gzip archive integrity (`gzip -t`), restores into a temporary test database (`nbhdb_drill`), validates table counts ($> 30$ tables), and cleans up.

---

## 7. Deployment Templates & Configuration Audit

| Configuration Check | Verification Result | Detail |
| :--- | :--- | :--- |
| **systemd EnvironmentFile** | **PASSED** | Zero trailing comments on assignment lines in `ORACLE_PRODUCTION_ENV.example`. Quoted strings for values with spaces (`COMPANY_NAME="Example Distribution Co."`). |
| **JWT Secret Format** | **PASSED** | Updated instructions strictly enforce Base64-encoded 256-bit keys (`openssl rand -base64 32`) matching `Decoders.BASE64.decode()`. |
| **Flyway Baseline** | **PASSED** | `DB_BASELINE_ON_MIGRATE=false` in production to enforce strict tracking of all migrations (V1 to V38). |
| **MySQL Durability** | **PASSED** | `innodb_flush_log_at_trx_commit = 1` for full ACID durability on NVMe storage. |
| **MySQL User Grants** | **PASSED** | Removed global `DROP` privilege from the application runtime user. |
| **NGINX SSE Proxy** | **PASSED** | Unbuffered proxying for `/api/v1/events` (`proxy_buffering off;`, `proxy_cache off;`, `proxy_read_timeout 3600s;`). |
| **NGINX Document Root** | **PASSED** | Configured `root /var/www/erp/current;` and `location /assets/ { alias /var/www/erp/assets/; }`. |
| **SSL Bootstrap Order** | **PASSED** | Two-step certificate bootstrap procedure documented to eliminate NGINX startup crashes from missing Let's Encrypt certificates. |
| **Health Endpoints** | **PASSED** | Configured `/api/v1/auth/csrf` (HTTP 200, unauthenticated) for health polling. Removed references to non-existent `/actuator/health`. |
| **Loopback Bindings** | **PASSED** | Spring Boot (`SERVER_ADDRESS=127.0.0.1:8080`) and MySQL (`bind-address=127.0.0.1:3306`) bound strictly to loopback with zero public port exposure. |

---

## 8. Automated Test Execution Results

| Test Suite | Purpose | Result |
| :--- | :--- | :--- |
| `task10a-session-policy.test.js` | 30-minute constants, activity tracking, active vs idle scenarios, cache clearance, and multi-tab coordination. | **PASS (6/6 tests)** |
| `idle-inactivity-logout.test.js` | Inactivity timer, activity throttling, and storage cleanup. | **PASS (5/5 tests)** |
| `task3-jwt-storage.test.js` | In-memory access token isolation, single-flight refresh on 401, SSE authorization headers. | **PASS (7/7 tests)** |
| `task3a-cross-tab-and-csrf.test.js` | Web Locks concurrency, mutex fallback, and multi-tab logout propagation. | **PASS (4/4 tests)** |
| `SecurityHardeningTask3Test` | Spring Boot token lifetimes (15m access / 30m refresh), rotation, replay detection, and CSRF protection. | **PASS (12/12 tests)** |
| Frontend Production Build (`npm run build`) | Vite compilation, chunk splitting, and asset hashing. | **PASS (10.48s, 0 errors)** |
| Backend Compilation (`./mvnw test-compile`) | Java 21 compilation, Spring Boot classes, and tests. | **PASS (0 errors)** |

**Total Automated Tests:** 34 tests  
**Pass Rate:** **100% (34 passed, 0 failed)**  

---

## 9. Exact First-Deployment Steps (Operator Runbook)

Follow these exact steps when launching NBH ERP on your Oracle Cloud account:

### Step 1: Create OCI Ampere A1 Instance
1. In the OCI Console, navigate to **Compute** &rarr; **Instances** &rarr; Click **Create Instance**.
2. Name: `nbh-erp-production`
3. Image: **Canonical Ubuntu 24.04 LTS (aarch64 / ARM64)**
4. Shape: **Ampere `VM.Standard.A1.Flex`** &rarr; **2 OCPUs**, **12 GB RAM**
5. Networking: Assign Public IPv4 &rarr; Upload SSH Key (`id_ed25519.pub`) &rarr; Boot Volume: **50 GB**
6. Click **Create** and record your **Public IPv4 Address**.

### Step 2: Configure VCN Security Ingress
In the VCN Default Security List, add ingress rules for:
- **Port 443 (HTTPS):** Source `0.0.0.0/0`
- **Port 80 (HTTP):** Source `0.0.0.0/0`
- **Port 22 (SSH):** Source `YOUR_ADMIN_IP/32` (or use OCI Bastion)
- **DO NOT** open port 3306 or 8080.

### Step 3: Configure DNS
Point `erp.example.com` to your OCI Public IPv4 address via an **A Record** with TTL 300s.

### Step 4: Server Setup & Package Installation
SSH into the instance:
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<YOUR_OCI_PUBLIC_IP>
```
Install runtime packages and configure UFW:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y openjdk-21-jre-headless mysql-server nginx certbot python3-certbot-nginx libfontconfig1 fonts-dejavu-core fail2ban ufw curl git unzip htop
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

### Step 5: Configure MySQL 8
Install tuning configuration:
```bash
# Apply MySQL tuning from ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md Section 7
sudo cp /path/to/99-nbh-erp.cnf /etc/mysql/mysql.conf.d/99-nbh-erp.cnf
sudo systemctl restart mysql && sudo systemctl enable mysql
sudo mysql_secure_installation
```
Create database and user:
```sql
CREATE DATABASE nbhdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nbh_erp'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY 'YOUR_STRONG_PASSWORD_32_CHARS';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON nbhdb.* TO 'nbh_erp'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### Step 6: Setup Directory Hierarchy & User
```bash
sudo useradd -r -m -s /usr/sbin/nologin -d /opt/erp erp
sudo mkdir -p /opt/erp/{config,scripts} /var/log/nbh-erp /var/www/erp/{releases,assets} /var/backups/nbh-erp
sudo chown -R erp:erp /opt/erp /var/log/nbh-erp
sudo chown -R www-data:www-data /var/www/erp
sudo chmod 750 /opt/erp /var/log/nbh-erp && sudo chmod 700 /var/backups/nbh-erp
```

### Step 7: Configure Production Environment Variables
Generate JWT Secret: `openssl rand -base64 32`  
Generate Backup Key: `openssl rand -base64 32 | sudo tee /opt/erp/config/.backup_key > /dev/null && sudo chmod 600 /opt/erp/config/.backup_key`  
Populate `/opt/erp/config/erp.env` from `ORACLE_PRODUCTION_ENV.example` and set permissions:
```bash
sudo chown erp:erp /opt/erp/config/erp.env && sudo chmod 600 /opt/erp/config/erp.env
```

### Step 8: Build & Install Application Artifacts
On your local machine:
```bash
./mvnw clean package -DskipTests
cd frontend && npm run build
scp -i ~/.ssh/id_ed25519 target/erp-0.0.1-SNAPSHOT.jar ubuntu@<IP>:/tmp/nbh-erp.jar
scp -i ~/.ssh/id_ed25519 -r frontend/dist ubuntu@<IP>:/tmp/dist
```
On the server:
```bash
sudo mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
sudo chown erp:erp /opt/erp/nbh-erp.jar && sudo chmod 644 /opt/erp/nbh-erp.jar

# Install initial frontend release and populate cumulative asset pool
sudo mkdir -p /var/www/erp/releases/release_initial
sudo cp -r /tmp/dist/* /var/www/erp/releases/release_initial/
sudo cp -r /tmp/dist/assets/* /var/www/erp/assets/
sudo chown -R www-data:www-data /var/www/erp && sudo chmod -R 755 /var/www/erp
sudo ln -sfn /var/www/erp/releases/release_initial /var/www/erp/current
rm -rf /tmp/dist
```

### Step 9: Start Spring Boot Service
```bash
sudo cp ORACLE_SPRINGBOOT_SYSTEMD.service /etc/systemd/system/nbh-erp.service
sudo systemctl daemon-reload && sudo systemctl enable --now nbh-erp.service
sudo journalctl -u nbh-erp.service -n 50 --no-pager
```

### Step 10: Acquire SSL & Enable NGINX
Follow the two-step certificate acquisition in `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` Section 12:
1. Run bootstrap HTTP NGINX configuration for Certbot ACME webroot.
2. Run `sudo certbot certonly --webroot -w /var/www/certbot -d erp.example.com`.
3. Deploy `ORACLE_NGINX_CONFIG.conf` to `/etc/nginx/sites-available/nbh-erp.conf`, enable it, test `sudo nginx -t`, and reload NGINX.

### Step 11: Setup Automated Backup Cron & Verification
Install `/opt/erp/scripts/backup-db.sh` and `/opt/erp/scripts/verify-backup.sh`.  
Verify backup execution: `sudo /opt/erp/scripts/backup-db.sh test`  
Verify restoration drill: `sudo /opt/erp/scripts/verify-backup.sh`  

---

## 10. Git Checkpoint

- **Pre-Task 10B Checkpoint:** `checkpoint-pre-task-10b`
- **Post-Task 10B Checkpoint:** `checkpoint-post-task-10b`
