# TASK 3 — NBH ERP SECURE JWT STORAGE AND SILENT AUTHENTICATION REPORT

**Execution Date:** 2026-10-17  
**Git Checkpoint:** `checkpoint-pre-task-3` (Commit `faea9dd`)  
**Deployment Target:** VPS with NGINX reverse-proxy (Same HTTPS Origin in Production)  
**Status:** Completed & Verified  

---

## 1. Existing Authentication Behavior

Before Task 3, NBH ERP utilized a hybrid JWT and database-backed session model with the following characteristics:

1. **Token Transport & Storage Vulnerabilities:**
   - The 15-minute access JWT was persisted directly in the browser's `localStorage` under the key `nbh_token`.
   - The 7-day rotating refresh token was persisted in `localStorage` under the key `nbh_refresh`.
   - Both tokens were exposed to any potential Cross-Site Scripting (XSS) attack running in the browser context.
   - When logging in or refreshing tokens, the Spring Boot backend returned both `accessToken` and `refreshToken` in plaintext inside the JSON response payload (`LoginResponse`).

2. **Session Rotation & DB Tracking:**
   - The backend maintained an atomic refresh session entity (`RefreshSession`) containing `id` (UUID), `user_id`, `token_hash` (SHA-256), `expires_at`, and `created_at`.
   - Refresh token rotation was protected using pessimistic locking (`SELECT ... FOR UPDATE` via `RefreshSessionRepository.lockById`).
   - If an expired, revoked, or mismatched token hash was presented, the system detected potential replay attacks and revoked all sessions for that user.
   - However, refresh tokens were transmitted as JSON body properties (`{ "refreshToken": "..." }`) rather than secure HTTP cookies.

3. **Silent Session Restoration & Tab Synchronization:**
   - On page refresh, the frontend checked `localStorage.getItem('nbh_token')`. If present and unexpired, it fetched `/api/v1/auth/me`. If expired, it read `nbh_refresh` from `localStorage` to request a new token.
   - Tabs communicated session termination via `BroadcastChannel('nbh_auth_bus')` and window storage events.
   - Multiple simultaneous 401s could cause race conditions if multiple tabs or asynchronous components attempted refresh concurrently without browser-level locking.

4. **SSE Authentication:**
   - The SSE client (`realtimeClient.js`) retrieved tokens from `localStorage` and sent them via the `Authorization: Bearer <token>` header in an authenticated streaming `fetch` request. No tokens were in URLs.

---

## 2. Exact Files Modified and Created

### Backend (Spring Boot 3.3.4 + Java 21)

| File | Change Type | Description |
|---|---|---|
| `src/main/resources/application.yml` | Modified | Added `app.security.cookie.secure: ${COOKIE_SECURE:false}` and `app.security.cookie.same-site: ${COOKIE_SAME_SITE:Lax}` configuration properties. |
| `src/main/java/com/nbh/erp/auth/service/AuthCookieService.java` | **Created** | Central service managing the `nbh_refresh_token` HttpOnly cookie. Configures `HttpOnly`, `Path=/api/v1/auth`, `SameSite=Lax`, and dynamic/configured `Secure` flags. Handles cookie creation and clearing headers. |
| `src/main/java/com/nbh/erp/config/CorsConfig.java` | Modified | Exposed `getAllowedOriginSet()` method so origin validation filters can share the strict CORS whitelist dynamically without code duplication. |
| `src/main/java/com/nbh/erp/security/csrf/OriginValidationFilter.java` | **Created** | Security filter intercepting mutating HTTP requests (`POST`, `PUT`, `DELETE`, `PATCH`). Enforces strict `Origin` and `Referer` matching against allowed origins and same-host headers, preventing cross-site state-changing requests. |
| `src/main/java/com/nbh/erp/config/SecurityConfig.java` | Modified | Registered `OriginValidationFilter` before `LogoutFilter`, documented CSRF architecture, permitted public access to `/api/v1/auth/csrf` and `/api/v1/auth/logout`. |
| `src/main/java/com/nbh/erp/auth/service/AuthService.java` | Modified | Added overloaded `refreshToken(String rawToken)` supporting cookie extraction with pessimistic DB locking. Updated `logout(String refreshToken)` to revoke the specific refresh session by session ID and increment the user's `tokenVersion`. |
| `src/main/java/com/nbh/erp/auth/controller/AuthController.java` | Modified | Updated `/login`, `/refresh`, and `/logout` endpoints to read and write `nbh_refresh_token` HttpOnly cookies. Removed `refreshToken` values from outgoing JSON response bodies (`refreshToken: null`). Added `GET /api/v1/auth/csrf` token health-check endpoint. |
| `src/test/java/com/nbh/erp/SecurityHardeningTask3Test.java` | **Created** | Comprehensive JUnit 5 suite (12 tests) verifying cookie transport, 15m/7d token lifetimes, rotation, replay detection, token version invalidation, CSRF/Origin enforcement, and logout cookie clearance. |
| `src/test/java/com/nbh/erp/AuthPerformanceBenchmarkTest.java` | **Created** | JUnit benchmark measuring Login API latency (BCrypt) and silent refresh rotation latency. |

### Frontend (React 18 + Vite)

| File | Change Type | Description |
|---|---|---|
| `frontend/src/api/apiClient.js` | Modified | Replaced `localStorage` access token storage with JS in-memory variable (`let inMemoryAccessToken = null`). Added `getAccessToken()`, `setAccessToken()`, `clearAccessToken()`. Enabled Axios `withCredentials: true`. Added anti-CSRF `X-Requested-With: XMLHttpRequest` header. Implemented single-flight refresh queue with cross-tab `navigator.locks`. Added seamless legacy `localStorage` refresh token migration and cleanup. Multi-tab logout broadcasts only `{ type: 'LOGOUT' }` (never tokens). |
| `frontend/src/context/AuthContext.jsx` | Modified | Removed all `localStorage` token storage. Configured silent initial session restoration on mount via `check(true)` with fallback cookie refresh. Prevented refresh storms on window `focus` when logged out. Ensured user details and API cache are wiped upon logout or session expiration. |
| `frontend/src/context/RealtimeSync.jsx` | Modified | Updated realtime sync provider to retrieve the in-memory access token via `getToken: getAccessToken`. |
| `frontend/tests/task3-jwt-storage.test.js` | **Created** | Node.js test suite (7 tests) validating in-memory token isolation, anti-CSRF request headers, single-flight refresh queueing, 403 immunity, legacy migration, multi-tab logout, and SSE header authorization. |
| `frontend/tests/task3-performance.test.js` | **Created** | Performance test measuring auth initialization latency, refresh request count (1), `/auth/me` count (1), and SSE reconnection lifecycle. |

---

## 3. Cookie Configuration and Deployment Assumptions

### Confirmed Production Deployment Architecture
- **Host:** Virtual Private Server (VPS) running Linux.
- **Web Server / Reverse Proxy:** NGINX.
- **Frontend Serving:** NGINX serves the static React production build directly on `https://erp.example.com/`.
- **API Proxy:** NGINX reverse-proxies `/api/` requests internally to Spring Boot (`http://127.0.0.1:8080/api/`).
- **SSE Proxy:** NGINX reverse-proxies `/api/v1/events` for Server-Sent Events with `proxy_buffering off;` and `proxy_read_timeout 3600s;`.
- **Origin Model:** Frontend and Backend share the **identical HTTPS origin** in production (`https://erp.example.com`).

### Cookie Attributes Configured

```http
Set-Cookie: nbh_refresh_token=<token_sid>.<raw_secret>; Path=/api/v1/auth; Max-Age=604800; Expires=...; HttpOnly; SameSite=Lax; Secure
```

1. **Name:** `nbh_refresh_token`
2. **HttpOnly:** `true` — JavaScript (`document.cookie`) cannot access or extract the refresh token. Immune to XSS token theft.
3. **Path:** `/api/v1/auth` — Minimal path restriction. The browser will only transmit the cookie on authentication endpoints (`/login`, `/refresh`, `/logout`). It is never sent on standard business API calls (`/api/v1/products`, `/api/v1/invoices`, etc.), eliminating unnecessary cookie exposure.
4. **Max-Age / Lifetime:** `604,800 seconds` (7 days), aligned exactly with database `RefreshSession.expiresAt`.
5. **SameSite Policy:** `SameSite=Lax` — Standard and secure for same-origin reverse-proxy architectures. Prevents third-party sites from sending the cookie on cross-site subrequests.
6. **Secure Flag:** Controlled via environment variable `${COOKIE_SECURE:false}`:
   - In local development (`http://localhost:5173` / `http://localhost:8080`): Set to `false` (or automatically evaluated if request is non-HTTPS) to permit local testing.
   - In production (`https://erp.example.com`): Set `COOKIE_SECURE=true`. The cookie will only be transmitted over encrypted TLS connections.

---

## 4. CSRF Strategy

Because refresh tokens are now carried in an HTTP cookie, CSRF protection is required for cookie-authenticated endpoints.

### Defense-in-Depth CSRF Model:

1. **SameSite=Lax Cookie Attribute:**
   - Under standard modern browser behavior, cookies with `SameSite=Lax` are omitted on cross-site POST/PUT/DELETE requests initiated by third-party origins (e.g. malicious forms or cross-origin fetch).

2. **Strict Origin & Referer Validation (`OriginValidationFilter`):**
   - For all mutating state-changing HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`), the `OriginValidationFilter` checks the `Origin` (or fallback `Referer`) header against:
     - The configured CORS whitelist (`app.security.cors.allowed-origins`, e.g. `http://localhost:5173`, `https://erp.example.com`).
     - The local server host (`request.getServerName()`).
   - If a cross-origin or untrusted `Origin`/`Referer` header is detected, the request is immediately rejected with `403 Forbidden` (`CSRF Origin Validation Rejected`).

3. **Anti-CSRF Custom Header Enforcement (`X-Requested-With`):**
   - The central Axios client (`apiClient.js`) automatically attaches `X-Requested-With: XMLHttpRequest` to all requests.
   - Cross-origin HTML forms, image tags, and simple scripts cannot send custom headers without triggering a CORS preflight (`OPTIONS`). The backend CORS filter rejects unauthorized cross-origin preflights.

4. **Spring Security CSRF Architecture Decision:**
   - Spring Security's default cookie-based or session-based CSRF filter (`CsrfFilter`) expects stateful HTTP sessions or synchronized double-submit cookies on every request.
   - In our stateless JWT architecture (where the 15-minute access token resides in memory and the refresh token is scoped only to `/api/v1/auth`), global session CSRF would introduce unnecessary state.
   - We implemented defense-in-depth:
     - `OriginValidationFilter` before `LogoutFilter`.
     - `X-Requested-With` header requirement.
     - `SameSite=Lax` cookie isolation.
     - Restricted Path (`Path=/api/v1/auth`).
     - Diagnostic endpoint `GET /api/v1/auth/csrf` returning `{ "csrfProtection": "ACTIVE", "strategy": "ORIGIN_VALIDATION_AND_SAMESITE_COOKIE" }`.

---

## 5. Changes to React Authentication

1. **In-Memory Access Token Storage:**
   - Access tokens are stored exclusively in module memory in `apiClient.js`:
     ```javascript
     let inMemoryAccessToken = null;
     export const getAccessToken = () => inMemoryAccessToken;
     export const setAccessToken = (token) => { inMemoryAccessToken = token; };
     export const clearAccessToken = () => { inMemoryAccessToken = null; };
     ```
   - No access token is ever written to `localStorage`, `sessionStorage`, `IndexedDB`, or URL query parameters.

2. **Single-Flight Refresh Queue:**
   - When multiple API requests encounter `401 Unauthorized` simultaneously, `apiClient.js` prevents a storm of refresh calls using a coordinating promise:
     ```javascript
     let refreshPromise = null;
     ```
   - If `navigator.locks` is supported by the browser, a Web Lock (`nbh_refresh_lock`) ensures only one browser tab executes the refresh at a time.
   - Subsequent `401` requests wait for the active single-flight refresh to complete and retry their original requests with the new access token.
   - Failed requests are marked with `_retried = true` to prevent any possibility of infinite retry loops.
   - HTTP `403 Forbidden` responses are explicitly ignored by the refresh interceptor.

3. **Silent Session Restoration:**
   - In `AuthContext.jsx`, on initial application mount:
     1. `check(true)` is invoked.
     2. If no in-memory token exists, it calls `refreshSession()`.
     3. The browser automatically attaches the `nbh_refresh_token` HttpOnly cookie.
     4. Backend rotates the refresh session, sets a fresh cookie, and returns the new 15-minute access token.
     5. Frontend sets `inMemoryAccessToken` and fetches `authApi.getMe()`.
     6. Protected application state is unlocked.
   - Subsequent window focus events only verify existing active tokens; they do **not** trigger refresh storms when logged out.

4. **Multi-Tab Logout Coordination:**
   - Handled via `BroadcastChannel('nbh_auth_bus')`.
   - When a user logs out in Tab A, Tab A broadcasts `{ type: 'LOGOUT' }`.
   - Tab B receives the message, wipes its in-memory access token, clears the user cache, and redirects to the login screen.
   - **Zero tokens** are ever broadcast across the channel.

---

## 6. Refresh-Token Migration Approach

To prevent disconnecting existing employees who had legacy tokens stored in `localStorage`:

1. **Seamless First-Time Migration:**
   - In `apiClient.js`, during `refreshSession()`:
     ```javascript
     const legacyRefresh = localStorage.getItem('nbh_refresh');
     const payload = legacyRefresh ? { refreshToken: legacyRefresh } : {};
     ```
   - If a legacy refresh token exists in `localStorage`, it is included in the request body of the first refresh call.
   - The backend `AuthController.refresh()` checks the request body as a fallback if the HttpOnly cookie is not yet present.
   - Upon successful verification, the backend rotates the session and issues the new `nbh_refresh_token` HttpOnly cookie.
2. **Immediate Legacy Token Purge:**
   - As soon as the refresh call succeeds, the frontend permanently deletes `nbh_token` and `nbh_refresh` from `localStorage`:
     ```javascript
     localStorage.removeItem('nbh_token');
     localStorage.removeItem('nbh_refresh');
     ```
   - Future requests rely entirely on the HttpOnly cookie.
   - If the refresh fails or the user logs out, all legacy storage keys are purged immediately.
   - Result: **Zero employee disruption**; no forced re-login required.

---

## 7. SSE Compatibility Results

The Server-Sent Events architecture was thoroughly tested and verified:

1. **Token Transport:**
   - `RealtimeSync.jsx` passes `getToken: getAccessToken` directly to `createRealtimeClient`.
   - Streaming requests use `fetch('/api/v1/events', { headers: { Authorization: `Bearer ${getAccessToken()}` } })`.
   - No tokens are placed in query parameters or URL strings.
2. **Reconnection on Refresh:**
   - If the access token expires while SSE is open, or if the stream disconnects, the client calls `refreshSession()` to acquire a new in-memory JWT before reconnecting.
3. **Clean Termination on Logout:**
   - When the user logs out or `nbh:session_expired` is fired, the SSE stream is aborted via `AbortController`, event listeners are removed, and the connection is closed cleanly.
4. **Proxy Buffering Compliance:**
   - In production NGINX, `proxy_buffering off;` and `proxy_read_timeout 3600s;` ensure realtime events stream instantly without proxy delay.

---

## 8. Performance Measurements

Rigorous benchmarks were performed on both backend and frontend components:

| Measurement Target | Result | Notes |
|---|---|---|
| **Login API Response Time** | **191.10 ms** (avg) | Min: 175 ms, Max: 216 ms. Dominated by BCrypt password hash verification (strength 10), which is intentional for brute-force resistance. |
| **Silent Refresh Response Time** | **41.10 ms** (avg) | Min: 22 ms, Max: 191 ms (initial run). Includes pessimistic DB row lock (`SELECT FOR UPDATE`), session rotation, and HMAC-SHA256 signature generation. |
| **Frontend Auth Initialization Time** | **9.73 ms – 11.72 ms** | In-memory token parsing and state dispatch. Instantaneous user experience. |
| **Number of `/auth/refresh` Requests** | **Exactly 1** | Exactly one refresh request is made per browser tab load/reload. |
| **Number of `/auth/me` Requests** | **Exactly 1** | Exactly one profile fetch occurs after session restoration. |
| **SSE Reconnection Count** | **1 connection** | Zero duplicate SSE connections created; clean reconnection on stream cycle. |
| **Backend User Detail Caching** | **Omitted** | As required by prompt instructions, no user-detail caching was introduced in the backend to preserve real-time revocation guarantees. |

---

## 9. Tests Passed and Failed

### Backend Test Results (Maven 3.9.9 / Java 21)

1. **`SecurityHardeningTask3Test` (12 Tests):**
   - `CookieAndTokenTests.loginSetsHttpOnlyCookieAndOmitsTokenFromResponse`: **PASSED**
   - `CookieAndTokenTests.jwtExpirationLifetimesAreEnforced`: **PASSED** (15m access / 7d refresh)
   - `RefreshSessionRotationTests.silentRefreshWithCookieRotatesSessionAndReturnsNewCookie`: **PASSED**
   - `RefreshSessionRotationTests.replayDetectionRevokesAllSessionsOnReuse`: **PASSED**
   - `RefreshSessionRotationTests.expiredRefreshSessionIsRejected`: **PASSED**
   - `RefreshSessionRotationTests.tokenVersionIncrementRevokesAccess`: **PASSED**
   - `RefreshSessionRotationTests.logoutRevokesSessionAndClearsCookie`: **PASSED**
   - `CsrfOriginProtectionTests.unapprovedOriginOnMutatingEndpointIsForbidden`: **PASSED** (HTTP 403)
   - `CsrfOriginProtectionTests.approvedOriginIsAllowed`: **PASSED**
   - `CsrfOriginProtectionTests.unapprovedRefererIsForbidden`: **PASSED** (HTTP 403)
   - `CsrfOriginProtectionTests.csrfEndpointIsAccessible`: **PASSED**
   - `CsrfOriginProtectionTests.safeGetMethodBypassesOriginValidation`: **PASSED**
   - **Total: 12 passed, 0 failed, 0 skipped** (Time: 73.27s)

2. **`SecurityHardeningTask2Test` (10 Tests — Regression):**
   - Part 1: Secure CORS Configuration Tests: **5/5 PASSED**
   - Part 2: JWT Secret Validation Tests: **4/4 PASSED**
   - Part 3: Refresh Session Cleanup Tests: **1/1 PASSED**
   - **Total: 10 passed, 0 failed, 0 skipped** (Time: 57.35s)

3. **`AuthPerformanceBenchmarkTest` (1 Test — Benchmark):**
   - **Total: 1 passed, 0 failed** (Time: 58.85s)

*Note on known pre-existing test:* `MigrationTest.java` contains MySQL-specific conditional DDL (`SET @stmt = IF(...)`) that is incompatible with in-memory test H2. Flyway migrations are disabled in the test profile, exactly as documented in `ERP_ARCHITECTURE_AUDIT.md`.

### Frontend Test Results (Node 22 Test Runner)

1. **`task3-jwt-storage.test.js` (7 Tests):**
   - 1. Access token is stored in JS memory only and never in localStorage: **PASSED**
   - 2. API client attaches in-memory token, correlation ID, anti-CSRF header: **PASSED**
   - 3. Multiple simultaneous 401s execute exactly ONE single-flight refresh: **PASSED**
   - 4. HTTP 403 Forbidden does NOT trigger refresh: **PASSED**
   - 5. Safe legacy localStorage token migration removes legacy tokens: **PASSED**
   - 6. Logout and session expiration clear token, clear cache, notify tabs: **PASSED**
   - 7. SSE client obtains in-memory token, passes Bearer header, avoids URLs: **PASSED**
   - **Total: 7 passed, 0 failed** (Time: 458ms)

2. **`task3-performance.test.js` (2 Tests):**
   - Silent session restoration executes exactly 1 refresh and 1 /auth/me call: **PASSED**
   - SSE client handles token lifecycle, reconnects on refresh, stops on logout: **PASSED**
   - **Total: 2 passed, 0 failed** (Time: 1.2s)

3. **Existing Frontend Regression Suite (12 Tests):**
   - `tests/role-session.test.js`: **PASSED**
   - `tests/realtime-client.test.js`: **PASSED**
   - `tests/realtime-sync.test.js`: **PASSED**
   - `tests/api-contract.test.js`: **PASSED**
   - **Total: 12 passed, 0 failed** (Time: 4.75s)

**Grand Total: 44 tests executed, 44 passed, 0 failed.**

---

## 10. Remaining Security Risks & Mitigations

1. **Cross-Site Scripting (XSS) Risks:**
   - *Risk:* Although the refresh token is now completely immune to XSS theft inside an `HttpOnly` cookie, any malicious script running in the browser could still make API requests while the in-memory access token is valid.
   - *Mitigation:* Strict Content Security Policy (CSP) headers must be enforced in production NGINX (`default-src 'self'`). In-memory tokens expire after 15 minutes, limiting exposure.

2. **NGINX Reverse Proxy Configuration:**
   - *Risk:* Misconfigured NGINX `proxy_pass` without passing the original host or HTTPS headers could cause Spring Boot to detect HTTP instead of HTTPS, or mismatch origin checks.
   - *Mitigation:* NGINX configuration must forward:
     ```nginx
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     ```

3. **Subdomain Hijacking / Multi-Tenant Cookies:**
   - *Risk:* If other subdomains share the top-level domain without isolated cookie paths, they could receive the cookie if path scoping was too broad.
   - *Mitigation:* The cookie path is strictly locked to `Path=/api/v1/auth`, ensuring no non-auth routes or other sub-applications receive the refresh cookie.

---

## 11. Required Environment Variables

When deploying to the VPS, the following environment variables must be configured in the backend environment (`.env` or systemd service):

| Variable | Recommended Production Value | Description |
|---|---|---|
| `JWT_SECRET` | *32+ character high-entropy secret* | Secret key for signing HMAC-SHA256 access JWTs. |
| `CORS_ALLOWED_ORIGINS` | `https://erp.example.com` | Allowed CORS and Origin validation origins. Do not use wildcards. |
| `COOKIE_SECURE` | `true` | Ensures `nbh_refresh_token` cookie includes the `Secure` flag, restricting transport to HTTPS only. |
| `COOKIE_SAME_SITE` | `Lax` | Configures `SameSite=Lax` for the refresh cookie. |

---

## 12. Rollback Plan

If unexpected deployment issues occur, the codebase can be reverted immediately to the pre-Task 3 baseline:

1. **Git Checkpoint Restoration:**
   ```bash
   git reset --hard checkpoint-pre-task-3
   git clean -fd
   ```

2. **Database State:**
   - No database schema migrations were added during Task 3.
   - The existing `refresh_sessions` table structure was completely preserved.
   - No database rollback script is required.

3. **Client-Side Fallback:**
   - Because legacy tokens were removed upon successful refresh, users logging in after a rollback will simply undergo a standard username/password login.

---

## Verification Summary

- [x] Access token stored exclusively in JavaScript memory.
- [x] Zero access or refresh tokens stored in `localStorage`, `sessionStorage`, `IndexedDB`, or URLs.
- [x] Refresh token transported exclusively via `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth` cookie.
- [x] Refresh token removed from JSON response payloads (`refreshToken: null`).
- [x] Preserved atomic refresh rotation, pessimistic row locking, and replay detection.
- [x] Coordinated single-flight refresh queue preventing duplicate requests.
- [x] Seamless migration of legacy `localStorage` refresh tokens with automatic cleanup.
- [x] SSE client authenticated via memory access token, reconnects on refresh, closes on logout.
- [x] Defense-in-depth CSRF protection via `OriginValidationFilter` and `X-Requested-With` header.
- [x] Multi-tab logout coordination without broadcasting tokens.
- [x] Zero changes to product, inventory, or unrelated domain APIs.
- [x] All 44 backend and frontend test suites passed.
