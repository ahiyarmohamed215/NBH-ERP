# TASK 3A — AUTHENTICATION SECURITY VERIFICATION REPORT

**Execution Date:** 2026-10-17  
**Scope:** Security Audit, Verification, and Targeted Hardening of Task 3 Authentication Implementation  
**Status:** Verification Complete — All Identified Security Issues Corrected & Verified  

---

## 1. Executive Summary & Verification Outcome

During Task 3A, a rigorous security inspection was conducted across the backend authentication filters, services, entity schemas, and frontend client synchronization logic. Six specific security vulnerabilities and implementation discrepancies were identified and resolved through targeted corrections:

1. **Missing Origin/Referer Bypass in CSRF Filter:** Previously, mutating requests with absent Origin and Referer headers were allowed through. Now, mutating requests to cookie-authenticated endpoints (`/refresh`, `/logout`) or carrying auth cookies are strictly rejected with HTTP 403 Forbidden.
2. **Unenforced `X-Requested-With` Header:** The backend previously did not validate the anti-CSRF custom header. Now, `OriginValidationFilter` strictly enforces `X-Requested-With: XMLHttpRequest` on cookie-authenticated operations.
3. **Spoofable Reverse-Proxy Headers (`X-Forwarded-Host`):** `OriginValidationFilter` previously trusted client-supplied `X-Forwarded-Host` headers without verification. Now, origin matching is strictly constrained to the immutable CORS whitelist (`corsConfig.getAllowedOriginSet()`) and verified server names.
4. **Cross-Tab Concurrency & False Replay Detection:** In browsers without Web Locks (or during concurrent tab initialization), simultaneous refresh requests sent identical refresh tokens, triggering false replay detection (401), followed by an unnecessary BroadcastChannel `LOGOUT` that terminated valid sessions. We implemented an automatic `localStorage` mutex fallback, a 1-time 60ms retry on transient 401, and prevented silent refresh failures from broadcasting global logout.
5. **Accidental Insecure Cookie Deployment Prevention:** In `AuthCookieService.java`, production HTTPS origins automatically enforce the `Secure` flag even if the operator forgets to specify `COOKIE_SECURE=true` in environment variables.
6. **Documentation Discrepancy Correction:** Reconciled documentation in `TASK_3_AUTHENTICATION_REPORT.md` with the true database schema: `RefreshSession` tracks `id` (sid), `username`, `tokenId` (`jti`), `tokenVersion`, and `expiresAt` (not `user_id`, `token_hash`, or `created_at`).

**Final Verification Verdict:**  
- **Task 3 is verified and ready for production configuration.**
- **The application is safe to proceed to Task 4.**

---

## 2. Confirmed Issues & Detailed Analysis

### Issue 1: Missing Origin and Referer Headers Accepted on Mutating Endpoints
- **Vulnerability:** In `OriginValidationFilter.java`, the filter checked `if (origin != null)` and `else if (referer != null)`, but if *both* headers were omitted, the request fell through to `filterChain.doFilter(request, response)`.
- **Attack Vector:** An attacker initiating CSRF via privacy-stripped requests (e.g. `<meta name="referrer" content="no-referrer">`) or rogue scripts could execute state-changing requests without providing origin verification.
- **Resolution:** `OriginValidationFilter` now checks if both headers are absent on mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`). If the request targets a cookie-authenticated endpoint (`/refresh`, `/logout`) or carries the `nbh_refresh_token` cookie, it is immediately blocked with HTTP 403 Forbidden.

### Issue 2: Anti-CSRF Header (`X-Requested-With`) Not Validated by Backend
- **Vulnerability:** The Task 3 report noted that the frontend sent `X-Requested-With: XMLHttpRequest`, but `OriginValidationFilter` never actually inspected or enforced this header.
- **Attack Vector:** An attacker could submit an HTML form (`<form method="POST" action=".../logout">`) from an external site. Standard browser forms cannot send custom headers, but without backend verification, this defense was inactive.
- **Resolution:** `OriginValidationFilter` now enforces `X-Requested-With: XMLHttpRequest` on all cookie-authenticated endpoints. Simple HTML forms, image tags, and iframes cannot set custom headers, and cross-site JavaScript cannot set headers without triggering a CORS preflight that our strict whitelist rejects.

### Issue 3: Client-Spoofable Reverse-Proxy Headers (`X-Forwarded-Host`)
- **Vulnerability:** In `OriginValidationFilter.java`:
  ```java
  String forwardedHost = request.getHeader("X-Forwarded-Host");
  String effectiveHost = (forwardedHost != null && !forwardedHost.isBlank()) ? forwardedHost : hostHeader;
  ```
- **Attack Vector:** Any attacker sending `X-Forwarded-Host: attacker.com` and `Origin: https://attacker.com` would pass origin validation because the code blindly trusted client-supplied headers without verifying whether the request came from a trusted reverse-proxy.
- **Resolution:** Removed raw `X-Forwarded-Host` matching. Origin matching is now strictly validated against `corsConfig.getAllowedOriginSet()` and validated local server ports.

### Issue 4: Cross-Tab Refresh Safety & False Replay Detection
- **Vulnerability:**
  1. In browsers or environments where `navigator.locks` is unavailable, two tabs refreshing at the same moment sent the identical initial refresh token. The first tab rotated the token to T2; the second tab was rejected by the server's pessimistic row lock with HTTP 401 ("Refresh token already used or expired").
  2. In `apiClient.js`, when a refresh failed, it immediately called `expireSession()`, which sent `{ type: 'LOGOUT' }` across `BroadcastChannel`. This caused Tab 1 (which had successfully refreshed) to be forcibly logged out!
  3. Furthermore, an unauthenticated guest visiting the ERP would trigger an initial silent refresh, receive 401 ("No refresh token provided"), call `expireSession()`, and store "Your session has expired" in `sessionStorage`.
- **Resolution:**
  - Implemented `acquireCrossTabLock` with a resilient `localStorage` mutex fallback (6-second expiry watchdog) when Web Locks is unavailable.
  - Added a 15ms browser cookie sync delay inside `perform()` to ensure multi-process cookie jars are committed before peer tabs execute.
  - Implemented a single automatic retry with 60ms backoff in `refreshSession()` if a 401 is encountered, allowing the tab to pick up the newly rotated cookie.
  - Changed error handling in `executeWithLock`: a failed silent refresh only clears the local tab's in-memory token and cache. It **never broadcasts `LOGOUT`** to peer tabs. Only explicit user logout propagates across tabs.

### Issue 5: Accidental Insecure Cookie Deployment Risk
- **Vulnerability:** If a systems administrator omitted `COOKIE_SECURE=true` in the production environment variables, and NGINX did not pass `X-Forwarded-Proto: https`, cookies could have been issued without the `Secure` flag.
- **Resolution:** `AuthCookieService.java` now checks if `corsConfig.getAllowedOriginSet()` consists exclusively of HTTPS production origins. If so, it automatically enforces `Secure=true`. A startup validation log warns if production origins are detected with `cookieSecureConfig=false`.

### Issue 6: Refresh Session Database Schema Discrepancy
- **Discrepancy:** `TASK_3_AUTHENTICATION_REPORT.md` stated that `RefreshSession` stored `user_id`, `token_hash`, and `created_at`.
- **Reality:** As confirmed in `RefreshSession.java`, `V1__initial_schema.sql`, and `V33__refresh_session_expires_at_idx.sql`:
  - `id`: Session UUID string (`sid`).
  - `username`: Associated user account.
  - `tokenId`: Current JWT ID (`jti`) matching the refresh token payload.
  - `tokenVersion`: Global revocation counter matching `user.tokenVersion`.
  - `expiresAt`: `Instant` timestamp for 7-day expiration.
- **Confirmation:** The actual implementation is superior: by storing `tokenId` (`jti`) rather than raw tokens, and verifying signed JWT claims inside pessimistic row locks (`lockById`), token rotation and replay detection are fully atomic without database hash overhead.

---

## 3. Actual Files Inspected

| Category | File Path |
|---|---|
| **Backend Filters & Config** | `src/main/java/com/nbh/erp/security/csrf/OriginValidationFilter.java`<br>`src/main/java/com/nbh/erp/config/SecurityConfig.java`<br>`src/main/java/com/nbh/erp/config/CorsConfig.java`<br>`src/main/resources/application.yml` |
| **Backend Auth Services** | `src/main/java/com/nbh/erp/auth/service/AuthService.java`<br>`src/main/java/com/nbh/erp/auth/service/AuthCookieService.java`<br>`src/main/java/com/nbh/erp/auth/controller/AuthController.java` |
| **Backend JWT & Entities** | `src/main/java/com/nbh/erp/security/jwt/JwtTokenProvider.java`<br>`src/main/java/com/nbh/erp/auth/entity/RefreshSession.java`<br>`src/main/java/com/nbh/erp/auth/repository/RefreshSessionRepository.java` |
| **Database Migrations** | `src/main/resources/db/migration/V1__initial_schema.sql`<br>`src/main/resources/db/migration/V33__refresh_session_expires_at_idx.sql` |
| **Frontend Clients & Context** | `frontend/src/api/apiClient.js`<br>`frontend/src/context/AuthContext.jsx`<br>`frontend/src/context/RealtimeSync.jsx`<br>`frontend/src/api/realtimeClient.js` |
| **Test Suites** | `src/test/java/com/nbh/erp/SecurityHardeningTask3Test.java`<br>`src/test/java/com/nbh/erp/SecurityHardeningTask2Test.java`<br>`src/test/java/com/nbh/erp/AuthPerformanceBenchmarkTest.java`<br>`frontend/tests/task3-jwt-storage.test.js`<br>`frontend/tests/task3-performance.test.js` |

---

## 4. Changes Made

### 1. `src/main/java/com/nbh/erp/security/csrf/OriginValidationFilter.java`
- Added constants `X_REQUESTED_WITH_HEADER` ("X-Requested-With") and `XML_HTTP_REQUEST` ("XMLHttpRequest").
- Enforced `X-Requested-With: XMLHttpRequest` on `/refresh`, `/logout`, and any request carrying an `nbh_refresh_token` cookie.
- Required `Origin` or `Referer` on cookie-authenticated requests. Missing both headers now triggers an explicit HTTP 403 Forbidden rejection.
- Removed reliance on unvalidated `X-Forwarded-Host` headers to prevent host spoofing.
- Preserved bypass for safe methods (`GET`, `HEAD`, `OPTIONS`).

### 2. `src/main/java/com/nbh/erp/auth/service/AuthCookieService.java`
- Injected `CorsConfig`.
- Configured host-only cookie behavior (omits `Domain` attribute in `ResponseCookie`, restricting cookie scope to the exact origin host).
- Added `isProductionOnlyConfig()` method: if allowed CORS origins consist strictly of HTTPS domains, `determineSecure()` defaults to `true`.
- Added `@PostConstruct` startup validation log alerting operators if production origins are configured with `cookieSecureConfig=false`.

### 3. `frontend/src/api/apiClient.js`
- Added `acquireCrossTabLock` fallback supporting browsers and environments without `navigator.locks` via a resilient `localStorage` mutex.
- Added 15ms cookie synchronization delay in `perform()` to prevent multi-process browser cache races.
- Added 1-time retry with 60ms delay in `refreshSession()` on transient 401s.
- Isolated silent refresh failures: `executeWithLock()` clears local in-memory token and cache, but **does not invoke `expireSession()`** and **does not broadcast `LOGOUT`** to peer tabs.

### 4. `src/test/java/com/nbh/erp/SecurityHardeningTask3ATest.java` (Created)
- 14 automated JUnit tests covering:
  - Missing Origin/Referer on `/refresh` and `/logout` (403 Forbidden).
  - Missing `X-Requested-With` header on `/refresh` and `/logout` (403 Forbidden).
  - Untrusted Origin and untrusted subdomains (403 Forbidden).
  - Spoofed `X-Forwarded-Host` rejection (403 Forbidden).
  - Legitimate request acceptance (200 OK).
  - Host-only cookie verification (no Domain attribute).
  - Logout cookie clearance with `Max-Age=0`.
  - Production HTTPS `Secure` flag auto-enforcement.
  - Sequential two-tab token rotation chain.
  - Replay detection rejection on reused refresh tokens.

### 5. `frontend/tests/task3a-cross-tab-and-csrf.test.js` (Created)
- 4 automated Node.js tests covering:
  - Two simulated tabs refreshing concurrently with Web Locks without replay collision.
  - Two simulated tabs refreshing concurrently without Web Locks (fallback mutex).
  - Failed silent refresh clearing local tab memory without broadcasting `LOGOUT`.
  - Explicit logout propagating `LOGOUT` across `BroadcastChannel` and clearing storage.

---

## 5. Tests Passed and Failed

### Automated Backend Tests (Maven / Java 21)

| Test Suite | Class Name | Tests Run | Passed | Failed | Execution Time |
|---|---|---|---|---|---|
| **Task 3A Security Verification** | `SecurityHardeningTask3ATest` | 14 | 14 | 0 | 52.65 s |
| **Task 3 Security Suite** | `SecurityHardeningTask3Test` | 12 | 12 | 0 | 39.75 s |
| **Task 2 Security Suite (Regression)** | `SecurityHardeningTask2Test` | 10 | 10 | 0 | 36.81 s |

### Automated Frontend Tests (Node.js 22 Test Runner)

| Test Suite | File | Tests Run | Passed | Failed |
|---|---|---|---|---|
| **Task 3A Cross-Tab & CSRF** | `tests/task3a-cross-tab-and-csrf.test.js` | 4 | 4 | 0 |
| **Task 3 JWT Storage & Replay** | `tests/task3-jwt-storage.test.js` | 7 | 7 | 0 |
| **Task 3 Performance & SSE** | `tests/task3-performance.test.js` | 2 | 2 | 0 |
| **Role & Session Lifecycle** | `tests/role-session.test.js` | 2 | 2 | 0 |
| **Realtime Client & Reconnection** | `tests/realtime-client.test.js` | 5 | 5 | 0 |
| **Realtime Workspace Sync** | `tests/realtime-sync.test.js` | 1 | 1 | 0 |
| **API Contract & Offline Handlers** | `tests/api-contract.test.js` | 4 | 4 | 0 |

**Grand Total:** **61 Tests Executed | 61 Passed | 0 Failed | 0 Skipped**

---

## 6. Remaining Risks & Operational Guidance

1. **Client-Side Cross-Site Scripting (XSS):**
   - *Risk:* While HttpOnly cookies protect refresh tokens from JavaScript exfiltration, an XSS vulnerability could allow an attacker to make authorized API calls using the in-memory access token during its 15-minute validity window.
   - *Mitigation:* Production NGINX must serve strict Content Security Policy (CSP) headers (`default-src 'self'`) and disable inline script execution.
2. **NGINX Reverse-Proxy Configuration:**
   - *Requirement:* When deploying the VPS NGINX configuration, the reverse proxy block for `/api/` must specify:
     ```nginx
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     ```
     This ensures Spring Boot correctly recognizes the client scheme and host.
3. **Database Clock Synchronization:**
   - *Requirement:* Ensure `systemd-timesyncd` or `chrony` is enabled on the VPS so the host server time remains synchronized for JWT expiration and scheduled refresh session cleanup.

---

## 7. Readiness Assessment

- **Is Task 3 ready for production configuration?**  
  **YES.** Token isolation, HttpOnly cookie transport, CSRF origin and header validation, single-flight refresh queueing, and multi-tab mutexes are fully verified and hardened.
- **Is the application safe to proceed to Task 4?**  
  **YES.** All regression and security test suites are passing with zero errors. All ERP business logic, SSE streaming, and database models remain completely intact.
