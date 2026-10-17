# TASK 2 — NBH ERP Security Configuration Hardening Report

**Report File:** `TASK_2_SECURITY_HARDENING_REPORT.md`  
**Target System:** NBH ERP (Single-Company Distribution & Warehouse Management System)  
**Technology Stack:** React 18 + Vite (Frontend), Spring Boot 3.3.4 + Java 21 (Backend), MySQL 8 (Database)  
**Status:** Completed and Verified via Automated Integration & Unit Tests  

---

## 1. Existing Implementation Summary

Prior to Task 2, the NBH ERP application contained three security weaknesses identified during the initial architecture audit (`ERP_ARCHITECTURE_AUDIT.md`):

1. **Permissive CORS Wildcard Configuration:**
   - In `CorsConfig.java`, `patternSet.add("https://*.vercel.app")` and `origins.contains("*")` dynamically allowed wildcard origins while `configuration.setAllowCredentials(true)` was enabled.
   - Any website or attacker tenant hosted on `*.vercel.app` could make credentialed, cross-origin requests to the ERP backend.
2. **Hardcoded Fallback JWT Secret:**
   - In `application.yml`, `app.jwt.secret` defaulted to a publicly committed 32-byte Base64 key: `dGVzdC1vbmx5LXNlY3JldC1rZXktMzItYnl0ZXMtbG9uZy0xMjM0NTY=`.
   - If the environment variable `JWT_SECRET` was omitted in deployment, the application started silently using this known key, leaving token signatures susceptible to forgery.
   - `JwtTokenProvider.java` did not validate secret length or Base64 encoding at startup.
3. **Unbounded Accumulation of Refresh Sessions:**
   - `refresh_session` records were inserted on every login and rotated on refresh.
   - Neither the application nor the database purged expired sessions, causing permanent database table accumulation.
   - The `refresh_session` table lacked an index on `expires_at`, resulting in full-table scans if bulk deletions were executed.

---

## 2. Security Problems Confirmed

* **CORS Wildcard with Credentials (High Severity):** Confirmed in `CorsConfig.java:31`. Allowed arbitrary Vercel subdomains to issue authenticated requests to the backend.
* **Exposed Default Secret Key (High Severity):** Confirmed in `application.yml:41`. Allowed HMAC-SHA256 signature generation if the deployment omitted `JWT_SECRET`.
* **Resource Leak / Denial of Service via Storage Bloat (Low-to-Medium Severity):** Confirmed in `RefreshSessionRepository.java` and `V1__initial_schema.sql:34`. Expired sessions grew without bound.

---

## 3. Exact Files Modified & Created

### Modified Existing Files:
1. `src/main/resources/application.yml`
   - Removed `https://*.vercel.app` from `app.cors.allowed-origins`.
   - Removed hardcoded fallback secret from `app.jwt.secret` (`${JWT_SECRET:}`).
   - Added configuration properties for refresh session retention and daily cleanup cron under `app.security.refresh-session`.
2. `src/main/java/com/nbh/erp/config/CorsConfig.java`
   - Removed `patternSet.add("https://*.vercel.app")` and wildcard pattern fallback logic.
   - Strictly enforced an explicit allowlist of approved origins (`http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, and production `https://nbh-erp.vercel.app`).
   - Disallowed wildcards (`*`) when credentials are enabled.
   - Preserved all required HTTP headers (`Authorization`, `Idempotency-Key`, `X-Request-Id`, etc.), methods, preflight cache duration (3600s), and SSE connectivity.
3. `src/main/java/com/nbh/erp/security/jwt/JwtTokenProvider.java`
   - Added startup validation checking that the JWT secret is present and non-blank.
   - Validated that the secret is valid Base64 and decodes to at least 32 bytes (256 bits) for HMAC-SHA256 security.
   - Ensured informative startup error messages without exposing the secret in logs.
   - Preserved 15-minute access token and 7-day refresh token expiration lifetimes.
4. `src/main/java/com/nbh/erp/ErpApplication.java`
   - Added `@EnableScheduling` to activate Spring's task scheduling infrastructure for periodic cleanup.
5. `src/main/java/com/nbh/erp/auth/repository/RefreshSessionRepository.java`
   - Added `@Modifying(clearAutomatically = true)` batch deletion query: `deleteByExpiresAtBefore(@Param("cutoff") Instant cutoff)`.

### Created New Files:
6. `src/main/resources/db/migration/V33__refresh_session_expires_at_idx.sql`
   - Created MySQL B-tree index `idx_refresh_session_expires_at` on `refresh_session(expires_at)` for high-efficiency indexed range deletions.
7. `src/main/java/com/nbh/erp/auth/service/RefreshSessionCleanupService.java`
   - Implemented daily scheduled cleanup service (`@Scheduled(cron = "${app.security.refresh-session.cleanup-cron:0 0 3 * * ?}")`).
   - Incorporated a configurable retention buffer (`app.security.refresh-session.retention-days: 1`, default 1 day past expiration) to prevent race conditions from clock skew and preserve investigation logs.
8. `src/test/java/com/nbh/erp/SecurityHardeningTask2Test.java`
   - Complete automated integration and unit test suite verifying CORS restrictions, JWT secret validation on startup, and session cleanup.

---

## 4. Changes Implemented

### Part 1: Secure CORS Configuration
* Replaced wildcard patterns with an explicit list of approved origins:
  - Development: `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`
  - Production: `https://nbh-erp.vercel.app` (configured as default in `application.yml` and overridable via `CORS_ALLOWED_ORIGINS`).
* Disallowed `*` and wildcard expressions when `allowCredentials(true)` is set.
* Retained support for custom headers: `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Request-Id`, `Accept`.
* Retained support for SSE streaming preflight on `/api/v1/events`.

### Part 2: Mandatory JWT Secret Validation
* Removed the hardcoded fallback secret from `application.yml`.
* Configured `JwtTokenProvider` to throw an `IllegalStateException` on startup if:
  - `JWT_SECRET` is missing, empty, or whitespace.
  - `JWT_SECRET` is not valid Base64.
  - Decoded key length is less than 32 bytes (256 bits).
* No secrets are printed or logged in error messages or application output.
* Existing token claims, signature algorithm (HMAC-SHA256), access expiration (15 min), and refresh expiration (7 days) remain intact.

### Part 3: Daily Refresh Session Purge with Retention Grace Period
* Created Flyway migration `V33__refresh_session_expires_at_idx.sql` adding `idx_refresh_session_expires_at`.
* Created `RefreshSessionCleanupService` running once daily at 03:00 AM server time (configurable via `REFRESH_SESSION_CLEANUP_CRON`).
* Enforced a safe retention window (`REFRESH_SESSION_RETENTION_DAYS: 1`, default 1 day):
  - Sessions expiring in the future are active and **never touched**.
  - Sessions expired within the last 24 hours are retained as a safety buffer for clock drift and investigation.
  - Sessions expired more than 24 hours ago are purged.
* Added `clearAutomatically = true` on the repository `@Modifying` query to keep the JPA persistence context in sync.

---

## 5. Configuration Changes Required

### Environment Variables for Deployment:
| Variable Name | Required? | Default / Fallback | Description |
|---|---|---|---|
| `JWT_SECRET` | **YES (Mandatory)** | *None* (Fails startup if missing) | Base64-encoded cryptographically random 256-bit key (minimum 32 decoded bytes). |
| `CORS_ALLOWED_ORIGINS` | Optional | `http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://nbh-erp.vercel.app` | Comma-separated list of approved frontend origins. No wildcards allowed. |
| `REFRESH_SESSION_RETENTION_DAYS` | Optional | `1` | Number of days past `expires_at` to retain expired sessions before purging. |
| `REFRESH_SESSION_CLEANUP_CRON` | Optional | `0 0 3 * * ?` | Cron expression for scheduled cleanup job (daily at 03:00 AM). |

> [!IMPORTANT]
> In production environments (e.g. Render, Docker, AWS), ensure `JWT_SECRET` is set in the environment variables. To generate a secure Base64 256-bit secret in PowerShell:
> ```powershell
> [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
> ```

---

## 6. Database Migrations

* **Migration Script:** `src/main/resources/db/migration/V33__refresh_session_expires_at_idx.sql`
* **DDL Executed:**
  ```sql
  CREATE INDEX idx_refresh_session_expires_at ON refresh_session (expires_at);
  ```
* **Impact:** Eliminates full-table scans during session cleanup; runs non-destructively in MySQL 8 without downtime.

---

## 7. Tests Executed

1. `SecurityHardeningTask2Test.java`:
   - `approvedDevOriginAccepted`: Preflight request from `http://localhost:5173` returns 200 OK with `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`.
   - `approvedProdOriginAccepted`: Preflight request from `https://nbh-erp.vercel.app` returns 200 OK.
   - `unapprovedVercelSubdomainRejected`: Preflight request from `https://malicious-tenant.vercel.app` receives no `Access-Control-Allow-Origin`.
   - `unapprovedExternalDomainRejected`: Preflight request from `https://attacker.evil.com` receives no `Access-Control-Allow-Origin`.
   - `ssePreflightAllowedForApprovedOrigin`: Preflight request to `/api/v1/events` with `Authorization` and `Accept` headers succeeds for approved origins.
   - `refusesMissingSecret`: Confirms startup fails when `JWT_SECRET` is null, empty, or blank.
   - `refusesNonBase64Secret`: Confirms startup fails when `JWT_SECRET` contains invalid characters.
   - `refusesWeakSecret`: Confirms startup fails when decoded key is less than 32 bytes (256 bits).
   - `acceptsValidSecret`: Confirms valid 32-byte secret generates and verifies access tokens (15m) and refresh tokens (7d).
   - `purgesOnlyExpiredEligibleSessions`: Confirms active sessions and sessions within the 24h grace period are preserved, while older expired sessions are purged.
2. `RoleAccessIntegrationTest.java`:
   - 9 regression tests verifying assigned module permissions, role creation, and access barriers.
3. `RealtimeIntegrationTest.java`:
   - 2 integration tests verifying SSE connection management, authentication, and event invalidation.

---

## 8. Tests Passed

* **`SecurityHardeningTask2Test`:** 10/10 tests PASSED (Build Success in 38.08s).
* **`RoleAccessIntegrationTest` & `RealtimeIntegrationTest`:** 11/11 tests PASSED (Build Success in 1m 00s).

---

## 9. Tests Failed / Skipped

* **`MigrationTest.java`:** Fails on preexisting `V6__customer_monthly_ranges.sql` MySQL-specific syntax (`SET @stmt = IF(...)`) when evaluated against an in-memory H2 database. As documented in `README.md:72-73`, H2 does not replace MySQL compatibility rehearsals; Flyway is disabled in test profiles (`spring.flyway.enabled=false`).
* **Frontend Node.js Tests:** 80 passed, 5 failed due to port conflicts (`Port 24678 is already in use` from background processes attempting to bind Vite ports in JSDOM tests). No frontend code was modified in this task.

---

## 10. Remaining Security Risks (Planned for Subsequent Tasks)

1. **LocalStorage Credential Storage:** Access JWTs and refresh tokens remain in browser `localStorage`. Migration to an in-memory access token and `HttpOnly`, `SameSite=Lax`, `Secure` refresh cookie is scheduled for Phase 6.
2. **Missing CSP / HSTS Security Headers:** Content-Security-Policy and Strict-Transport-Security headers should be configured in `SecurityConfig.java`.
3. **Per-Request Database Authentication Overhead:** `JwtAuthenticationFilter` queries `loadUserByUsername` on every request. Introducing a 30s in-memory Caffeine cache is scheduled for Phase 2.

---

## 11. Deployment Considerations

1. **Production Key Continuity:**
   - If the production environment is currently relying on the old fallback key (`dGVzdC1vbmx5LXNlY3JldC1rZXktMzItYnl0ZXMtbG9uZy0xMjM0NTY=`), setting a new random `JWT_SECRET` in production will require active users to log in again upon deployment.
   - Coordinate deployment during off-peak hours or notify users to sign in after deployment.
2. **Flyway Migration V33:**
   - Ensure Flyway runs automatically on startup (`spring.flyway.enabled=true`). Migration `V33` will apply `idx_refresh_session_expires_at` seamlessly.

---

## 12. Rollback Instructions

If a rollback is required:
1. Revert Git changes:
   ```powershell
   git checkout checkpoint-task-2-start -- src/main/resources/application.yml src/main/java/com/nbh/erp/config/CorsConfig.java src/main/java/com/nbh/erp/security/jwt/JwtTokenProvider.java src/main/java/com/nbh/erp/ErpApplication.java src/main/java/com/nbh/erp/auth/repository/RefreshSessionRepository.java
   Remove-Item src/main/java/com/nbh/erp/auth/service/RefreshSessionCleanupService.java
   Remove-Item src/main/resources/db/migration/V33__refresh_session_expires_at_idx.sql
   Remove-Item src/test/java/com/nbh/erp/SecurityHardeningTask2Test.java
   ```
2. Database rollback (if migration V33 was applied):
   ```sql
   DROP INDEX idx_refresh_session_expires_at ON refresh_session;
   DELETE FROM flyway_schema_history WHERE version = '33';
   ```
3. Restart the application.
