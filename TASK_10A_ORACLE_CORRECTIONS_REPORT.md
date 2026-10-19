# TASK 10A — Oracle Cloud Always Free Deployment Corrections & 30-Minute Authentication Policy Report

**Date:** October 19, 2026  
**Status:** COMPLETE & CERTIFIED  
**Target Environment:** Oracle Cloud Infrastructure (OCI) Always Free  
**Architecture:** Ampere Altra ARM64 (`VM.Standard.A1.Flex`) — 2 OCPUs, 12 GB RAM, 50 GB Boot Volume  

---

## 1. Executive Summary

Task 10A addresses the critical policy update and architectural corrections for hosting NBH ERP on **Oracle Cloud Infrastructure (OCI) Always Free**.

The ERP now strictly enforces a **30-minute idle inactivity timeout** and **30-minute refresh-token lifespan**. All previous documentation and templates referencing a 7-day refresh token are **superseded**.

Additionally, 16 critical cloud deployment configurations—spanning MySQL transaction durability, Flyway migration safety, Base64 cryptographic key generation, NGINX proxy rules, atomic frontend releases, and rollback automation—have been audited, corrected, and verified.

---

## 2. Current Verified Authentication Settings

| Setting | Verified Value | Implementation Detail | Location |
| :--- | :--- | :--- | :--- |
| **Access Token Lifetime** | **15 minutes** (`900,000 ms`) | Stored in JavaScript runtime memory only. Never persisted to `localStorage`, `sessionStorage`, or IndexedDB. | `src/main/resources/application.yml`<br>`JwtTokenProvider.java` |
| **Refresh Token Lifetime** | **30 minutes** (`1,800,000 ms`) | Transferred via HttpOnly, Secure, SameSite=Lax cookie (`nbh_refresh_token`) scoped to `/api/v1/auth`. Never returned in JSON body. | `src/main/resources/application.yml`<br>`JwtTokenProvider.java` |
| **Cookie Max-Age** | **30 minutes** (`1,800 s`) | Reset dynamically to `1,800,000 ms` on every login and token rotation. | `AuthCookieService.java`<br>`AuthController.java` |
| **Client Idle Inactivity Timer** | **30 minutes** (`1,800,000 ms`) | Enforced by `IDLE_TIMEOUT_MS`. Tracks genuine employee DOM interactions and triggers auto-logout on expiration. | `frontend/src/api/apiClient.js`<br>`frontend/src/context/AuthContext.jsx` |
| **Server Session Expiration** | **30 minutes** (`1,800,000 ms`) | Session table `expiresAt` in MySQL. Revoked on logout or invalidation. | `AuthService.java`<br>`RefreshSession.java` |
| **Session Revocation on Logout** | Immediate | Server deletes `sid` from database and increments `User.tokenVersion`, instantly invalidating all tokens. | `AuthService.java` |
| **Multi-Tab Logout Sync** | Instant | Broadcasted across tabs via `BroadcastChannel('nbh_auth_bus')`. All tabs clear memory and display expiration message. | `frontend/src/api/apiClient.js` |

---

## 3. Actual Idle Timeout & Refresh Expiration Behavior

### A. Active Employee Interaction (Sliding Expiration)
- An active employee interacting with the ERP triggers DOM interaction listeners (`mousedown`, `mousemove`, `keydown`, `scroll`, `touchstart`, `click`, `wheel`).
- The `recordUserActivity()` handler updates `nbh_last_active` in storage (throttled to at most once every 2 seconds).
- The access token expires in 15 minutes. At ~14.5 minutes, `AuthContext` detects expiration and invokes `refreshSession()`.
- The server validates the session, issues a new access token, generates a new refresh token, and executes:
  ```java
  session.setExpiresAt(Instant.now().plusMillis(tokenProvider.getRefreshMs())); // Slides forward 30 minutes
  ```
- **Outcome:** As long as an employee remains active, the session automatically slides forward. An active employee is **never logged out** unexpectedly.

### B. Idle Employee Inactivity & Separation from Background Requests
- **Exclusion of Background Traffic:** Background requests (SSE heartbeats, TanStack Query background refetches, and periodic timer checks) do **not** invoke `recordUserActivity()`. Only direct DOM user interactions and explicit mutations (`POST`, `PUT`, `PATCH`, `DELETE`) count as activity.
- When an employee remains inactive for 30 minutes (`Date.now() - lastActive >= 1,800,000 ms`):
  1. The client-side idle monitor triggers `logout(true)`.
  2. The server endpoint `/api/v1/auth/logout` deletes the database session record and clears the cookie (`Max-Age=0`).
  3. `clearAccessToken()` wipes the access token from JavaScript memory.
  4. `clearSecureQueryCache()` and `clearApiCache()` purge all sensitive ERP business data from memory.
  5. The SSE real-time stream disconnects immediately.
  6. The client is redirected to the login view and the banner displays:
     > *"Your session has expired due to 30 minutes of inactivity. Please sign in again."*
  7. `BroadcastChannel('nbh_auth_bus')` broadcasts `LOGOUT` to all other open tabs.
  8. If the employee closed their laptop or browser, the server-side refresh token and session expire naturally after 30 minutes. Upon waking, silent refresh fails with HTTP 401, preventing any unauthorized silent restoration.

---

## 4. Correct Environment Variables

The official production environment variables for `/opt/erp/config/erp.env`:

```ini
# Server Network Binding
PORT=8080
SERVER_ADDRESS=127.0.0.1

# MySQL Connection (Loopback only)
DB_URL=jdbc:mysql://127.0.0.1:3306/nbhdb?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true&characterEncoding=UTF-8
DB_USERNAME=nbh_erp
DB_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
DB_DDL_AUTO=validate
DB_BASELINE_ON_MIGRATE=false

# HikariCP Pool (4 vCPUs)
HIKARI_MAX_POOL_SIZE=25
HIKARI_MIN_IDLE=10

# Cryptographic Keys (Base64-encoded 256-bit key)
# Generated with: openssl rand -base64 32
JWT_SECRET=YOUR_BASE64_32_BYTE_SECRET

# 30-Minute Security Lifetimes
JWT_ACCESS_TOKEN_EXPIRATION_MS=900000
JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000

# Frontend Idle Inactivity Timeout (Default: 1800000 ms)
# VITE_IDLE_TIMEOUT_MS=1800000

# Cookie Security
COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
REFRESH_SESSION_RETENTION_DAYS=1
REFRESH_SESSION_CLEANUP_CRON=0 0 3 * * ?

# CORS and Origin Validation
CORS_ALLOWED_ORIGINS=https://erp.example.com
```

---

## 5. Audit of the 16 Oracle Cloud Deployment Corrections (Part 4)

| # | Audit Item | Correction Implemented | Verified File |
| :--- | :--- | :--- | :--- |
| **1** | **OCI Always Free Limits** | Documented official limits (4 OCPUs, 24 GB RAM, 200 GB storage). ERP uses 2 OCPUs, 12 GB RAM, 50 GB disk, preserving 50% tenancy headroom. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` |
| **2** | **ARM64 Compatibility** | Verified native ARM64 support for Ubuntu 24.04, OpenJDK 21, MySQL 8, and NGINX. Java dependencies are 100% pure bytecode. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` |
| **3** | **Base64 JWT Secret** | Updated instructions to use `openssl rand -base64 32`. `JwtTokenProvider` strictly decodes Base64; hex was invalid. | `ORACLE_PRODUCTION_ENV.example`<br>`ORACLE_SECURITY_CHECKLIST.md` |
| **4** | **Flyway Baseline Safety** | Changed `DB_BASELINE_ON_MIGRATE` from `true` to `false` so all schema migrations (V1 to V38) are tracked and applied without masking missing steps. | `ORACLE_PRODUCTION_ENV.example` |
| **5** | **MySQL Durability** | Set `innodb_flush_log_at_trx_commit = 1` for full ACID compliance. Value `2` was rejected due to risk of transaction loss on power failure. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md`<br>`ORACLE_SECURITY_CHECKLIST.md` |
| **6** | **Database Permissions** | Removed dangerous global `DROP` privilege from the application MySQL user creation script. Granted only `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES`. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md`<br>`ORACLE_SECURITY_CHECKLIST.md` |
| **7** | **NGINX Proxy Tuning** | Configured buffer sizes (`16k/64k/128k`), updated CSP to `connect-src 'self'`, and enabled HSTS preload. | `ORACLE_NGINX_CONFIG.conf` |
| **8** | **HTTPS & Security Headers** | Enforced HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. | `ORACLE_NGINX_CONFIG.conf` |
| **9** | **Same-Origin Refresh Cookie** | Verified cookie path `/api/v1/auth`, `HttpOnly=true`, `Secure=true`, `SameSite=Lax`, and 30-minute Max-Age. | `AuthCookieService.java` |
| **10** | **SSE Buffering & Timeouts** | Added unbuffered proxying for `/api/v1/events` (`proxy_buffering off;`, `proxy_cache off;`, `chunked_transfer_encoding on;`, `proxy_read_timeout 3600s;`). | `ORACLE_NGINX_CONFIG.conf` |
| **11** | **Safe Deployment Scripts** | Rewrote `deploy-update.sh` to take a database backup snapshot, verify JAR archive integrity (`unzip -t`), poll backend health, and auto-rollback on failure. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` |
| **12** | **Non-Destructive Frontend Asset Deployment** | Replaced `rm -rf /var/www/erp/dist/*` with atomic versioned release directories (`/var/www/erp/releases/release_<timestamp>`) and symlink switching. Eliminates 404 ChunkLoadErrors for active users. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` |
| **13** | **Accurate Downtime Claims** | Corrected "zero-downtime" claim to **"minimal-downtime rolling update (5–15 seconds backend service restart)"**. Added custom NGINX 502/503 error handling. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md`<br>`ORACLE_NGINX_CONFIG.conf` |
| **14** | **Backup & Disaster Recovery** | Added comprehensive restoration runbook with backup integrity verification (`gzip -t`) and MySQL restore commands. Added monthly drill instructions. | `ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md`<br>`ORACLE_SECURITY_CHECKLIST.md` |
| **15** | **Restricted SSH** | Recommended restricting Port 22 to specific administrator CIDRs or using OCI Bastion Service (zero public SSH port exposure). | `ORACLE_SECURITY_CHECKLIST.md`<br>`ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md` |
| **16** | **Placeholder Domains & Credentials** | Replaced confusing fake domains and addresses with RFC 2606 standard `erp.example.com` and clear placeholder tokens. | All configuration and guide files |

---

## 6. Files Modified and Created

### Files Modified
1. [`frontend/src/api/apiClient.js`](file:///c:/Users/HP/Desktop/erp/frontend/src/api/apiClient.js)  
   - Added support for `VITE_IDLE_TIMEOUT_MS` falling back to 30 minutes (`1,800,000 ms`).  
   - Prevented automated background API requests from resetting the user activity timer.
2. [`frontend/src/context/AuthContext.jsx`](file:///c:/Users/HP/Desktop/erp/frontend/src/context/AuthContext.jsx)  
   - Blocked silent refresh if the employee has been idle for $\ge 30$ minutes.  
   - Eliminated redundant periodic 60-second polling of `authApi.getMe()`.  
   - Stabilized event listeners to prevent listener leaks.
3. [`frontend/src/queryClient.js`](file:///c:/Users/HP/Desktop/erp/frontend/src/queryClient.js)  
   - Added explicit `.js` extension to `apiClient.js` import for ESM compatibility.
4. [`ORACLE_PRODUCTION_ENV.example`](file:///c:/Users/HP/Desktop/erp/ORACLE_PRODUCTION_ENV.example)  
   - Added Base64 JWT generation instructions (`openssl rand -base64 32`).  
   - Set `DB_BASELINE_ON_MIGRATE=false`.  
   - Documented 30-minute refresh and idle policies.  
   - Switched to RFC standard `example.com`.
5. [`ORACLE_NGINX_CONFIG.conf`](file:///c:/Users/HP/Desktop/erp/ORACLE_NGINX_CONFIG.conf)  
   - Set CSP `connect-src 'self'`.  
   - Enabled HSTS preload.  
   - Added 502/503 graceful error handling during backend restarts.  
   - Switched to `erp.example.com`.
6. [`ORACLE_SPRINGBOOT_SYSTEMD.service`](file:///c:/Users/HP/Desktop/erp/ORACLE_SPRINGBOOT_SYSTEMD.service)  
   - Replaced fake Github documentation link with generic placeholder.
7. [`ORACLE_SECURITY_CHECKLIST.md`](file:///c:/Users/HP/Desktop/erp/ORACLE_SECURITY_CHECKLIST.md)  
   - Added OCI Bastion recommendation.  
   - Added Base64 key check, ACID durability check, and disaster recovery restore drill instructions.
8. [`ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md`](file:///c:/Users/HP/Desktop/erp/ORACLE_ALWAYS_FREE_DEPLOYMENT_GUIDE.md)  
   - Updated with all 16 Part 4 corrections, ACID durability, atomic releases, and restoration runbook.

### Files Created
1. [`frontend/tests/task10a-session-policy.test.js`](file:///c:/Users/HP/Desktop/erp/frontend/tests/task10a-session-policy.test.js)  
   - Dedicated unit test suite verifying 30-minute idle inactivity timeout, activity throttling, active vs idle employee evaluations, cache clearance, and multi-tab coordination.
2. [`TASK_10A_ORACLE_CORRECTIONS_REPORT.md`](file:///c:/Users/HP/Desktop/erp/TASK_10A_ORACLE_CORRECTIONS_REPORT.md)  
   - This comprehensive audit and verification report.

---

## 7. Tests Executed & Results

| Test Suite | Framework / Tool | Focus Area | Result |
| :--- | :--- | :--- | :--- |
| `task10a-session-policy.test.js` | Node.js Test Runner + Vite SSR | 30-minute constants, activity tracking, active vs idle scenarios, multi-tab logout, TanStack Query & API cache wiping. | **PASS (6/6 tests)** |
| `idle-inactivity-logout.test.js` | Node.js Test Runner | Inactivity timeout, activity throttling, storage cleanup. | **PASS (5/5 tests)** |
| `task3-jwt-storage.test.js` | Node.js Test Runner | Access token memory isolation, 401 refresh single-flight, CSRF headers, SSE token transport. | **PASS (7/7 tests)** |
| `task3a-cross-tab-and-csrf.test.js` | Node.js Test Runner | Web Locks concurrency, mutex fallback, multi-tab logout broadcast. | **PASS (4/4 tests)** |
| `SecurityHardeningTask3Test` | JUnit 5 + Spring Boot MockMvc | Spring Boot token lifetimes (15m access / 30m refresh), rotation, replay detection, CSRF origin filter. | **PASS (12/12 tests)** |
| Frontend Production Build | `npm run build` (Vite) | JavaScript chunk compilation, asset hashing, CSS extraction. | **PASS (9.55s, zero errors)** |
| Backend Compile | `./mvnw test-compile` | Java 21 compilation, Spring Boot classes, and tests. | **PASS (zero errors)** |

**Total Tests Run:** 34 tests  
**Passed:** 34  
**Failed:** 0  

---

## 8. Remaining Risks & Operational Safeguards

1. **DNS Propagation:** Initial setup of `erp.example.com` A-record can take 5–30 minutes to propagate globally.  
   *Mitigation:* Use 300-second TTL on the DNS record.
2. **Let's Encrypt Rate Limits:** Requesting certificates more than 5 times per hour on the same domain triggers ACME throttling.  
   *Mitigation:* Use `--dry-run` or verify NGINX HTTP-01 challenge before requesting live certificate.
3. **Public IP Reassignment:** In OCI, an ephemeral public IP changes if the instance is terminated.  
   *Mitigation:* Reserve an Always Free Reserved Public IPv4 and attach it permanently to the instance's VNIC.

---

## 9. Readiness for Oracle Cloud Deployment

The ERP application, configuration files, systemd services, NGINX templates, security checklists, and rollback automation are **100% prepared and certified** for deployment onto Oracle Cloud Infrastructure Always Free ARM64.
