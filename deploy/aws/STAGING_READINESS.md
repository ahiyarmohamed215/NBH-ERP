# Staging release preparation

No AWS connection, deployment, database migration, account creation, commit or push is part of this preparation.

## Files changed in this preparation

- Repository/CI: `.gitignore`, `.env.example`, `.github/workflows/verify.yml`.
- Backend: `src/main/java/com/nbh/erp/auth/service/AuthService.java`, `auth/service/LoginProtection.java`, `security/LoginThrottleFilter.java`, `config/SecurityConfig.java`, `config/RequestIdFilter.java`, `common/handler/GlobalExceptionHandler.java` (abbreviated paths share `src/main/java/com/nbh/erp/`).
- Backend tests under `src/test/java/com/nbh/erp/`: `LoginProtectionTest.java`, `LoginFailureSecurityTest.java`, `AdministratorAuthenticationSecurityTest.java`, `AuthenticationProviderSecurityTest.java`, `SignupValidationTest.java`.
- Frontend: `frontend/src/api/apiClient.js`, `frontend/src/views/LoginView.jsx`, `frontend/src/views/InvoicingHub.jsx`, `frontend/src/utils/printReport.js`, `frontend/src/utils/customerPrintTemplates.js`.
- Frontend tests under `frontend/tests/`: `staging-security.test.js`, `csp-browser.mjs`, `auth-logout-and-credentials.test.js`, `delivery-layout.test.js`, `grn-interactions.test.js`, `inventory-printing.test.js`, `purchasing-status.test.js`, `inventory-master-workspace.test.js`, `purchasing-inspection.test.js`, `pos-original-copies.test.js`. Existing assertions are preserved in the print tests; their popup mocks now provide the DOM/printing methods used by parent JavaScript.
- Deployment: `deploy/aws/nginx.conf`, `deploy/aws/verify_migrations.py`, `deploy/aws/staging-deploy.yml.example`, this document.

This list distinguishes this preparation from the many earlier working-tree changes, including the pre-existing production profile and staged migrations. The separate Git-status inventory records all staged, unstaged and untracked paths.

## Login controls

- The password-login endpoint uses a token bucket per resolved client IP: burst 120, refill 120/minute. Different accounts behind one office NAT share this generous budget. An exhausted IP receives HTTP 429 with Retry-After: 60. OPTIONS, refresh and logout are unaffected.
- Account protection reserves attempts atomically before authentication. Five attempts without a successful login trigger a 30-second cooldown; repeated rounds increase it to 60, 120, 240 and at most 300 seconds. Denied requests do not extend the cooldown. Success resets that account; 15 minutes of inactivity expires its state. Reservations also bound concurrent password checks.
- Username, email and case variants resolving to a user share the immutable user ID budget. Unknown names perform the same dummy comparison without allocating account-cache entries, so random usernames cannot exhaust the real-account cache. Disabled, unapproved, nonexistent, wrong-password and cooling-down logins all return HTTP 401 / INVALID_CREDENTIALS. Rejected pre-provider requests perform a dummy BCrypt comparison. No tokens or refresh cookies are issued for these failures.
- State is process-local, capped at 20,000 entries per map, and fails closed for new keys at capacity until stale entries expire. Restart clears state. This is intended for one staging JVM; use shared atomic storage before adding replicas, and monitor capacity/denial rates. Cooldowns reduce online guessing; distributed attacks and deliberate account disruption remain possible.
- Login audit records use fixed outcome codes and an internal account ID only on success. Passwords, submitted identifiers, tokens, raw forwarding headers and provider exception text are excluded. IP-denial logging is capped at one event/minute per process. Request IDs are restricted to 1–64 safe characters before entering MDC.
- Keep port 8080 on loopback and keep Tomcat's trusted proxy restriction. NGINX overwrites X-Forwarded-For with its resolved client address. The supplied configuration assumes clients connect directly to NGINX; adding ALB/CloudFront requires an explicit trusted-proxy design.

## Printing and CSP

All five NGINX CSP copies retain script-src 'self'; only frame-src adds blob:. object-src 'none' and base-uri 'self' are explicit. Report/invoice printing and customer print buttons run from parent JavaScript instead of executable inline HTML. PDF iframe handlers are attached before navigation; popup blob URLs are released when the popup leaves the page. Existing style allowances are unchanged.

The optional `frontend/tests/csp-browser.mjs` serves local fixtures and checks the actual policy in Chromium. The standard frontend tests cover generated HTML, controls, fallback frames and policy consistency. Native PDF viewer behavior and actual OS print dialogs still require browser testing on staging under HTTPS.

## CI proposal

`.github/workflows/verify.yml` runs backend tests/package, migration Git/JAR integrity checks, frontend tests, Chromium CSP checks and a same-origin Vite production build on push/PR. Artifacts contain only the JAR or dist directory, not the repository or environment files. Tests use disposable H2 with Flyway and bootstrap disabled; they do not validate MySQL SQL or contact RDS.

`deploy/aws/staging-deploy.yml.example` is a deliberately inactive proposal. It has only workflow_dispatch, reruns CI, restricts staging to main, references the staging Environment, and serializes releases. Its deployment step fails intentionally; no transport/credentials or AWS commands are configured. Before approving activation:

1. Create the GitHub staging Environment, configure required reviewers, prevent self-review and restrict branches. Confirm your GitHub plan supports these protections. The environment declaration alone does not enforce human approval.
2. Review a separate least-privilege deployment transport, artifact digest verification, backups and rollback procedure. Approve that script before replacing the disabled step or installing the workflow.
3. Configure credentials only in the protected environment after that review; prefer short-lived identity. Never place server DB passwords, SSH keys or certificates in Git or build artifacts.

## Proposed release commit plan (no staging/committing performed)

1. Review the complete working-tree inventory. There are extensive pre-existing feature edits; do not use git add . or sweep unrelated work into a security commit. Review diffs and split overlapping files using deliberate hunks.
2. Commit coherent existing feature/entity/API/UI/test changes with their already-staged V45–V53 migration additions. These versions must not be omitted from the release or reordered. Earlier migrations must remain byte-identical. This step needs a separate scope review because it predates the current security changes.
3. Commit the prior bootstrap/role fixes and their tests, then the login protections, printing fixes and regressions. Where changes overlap, review the combined behavior rather than overwriting prior work.
4. Commit production profile, AWS templates/docs, obsolete provider-file removals, ignore rules, CI and offline migration verifier. Include application-prod.yml and every required untracked source file explicitly. Review application.yml and Dockerfile diffs too.
5. Verify the index contains no real .env files, credentials, certificates/private keys, caches, logs or build outputs. Review placeholder examples privately. Inspect git diff --cached before approving any commit.
6. Re-run CI on the exact proposed release tree. Tag or pin a reviewed immutable commit only after all checks pass. Push, workflow activation and deployment each remain subject to your approval.

## Verification results

All commands ran in a disposable workspace. Spring integration tests used H2 with Flyway disabled; no local MySQL or RDS database was used.

| Check | Result |
| --- | --- |
| Related backend authentication/bootstrap/signup/configuration tests | 57 passed |
| Final focused backend tests after the cache-flood protection change | 24 passed (overlaps the preceding run) |
| Final frontend login/printing/CSP/PDF-lifetime regression tests | 11 passed |
| Real Chromium CSP/report-printing/blob-frame check | Passed |
| Backend production JAR build | Passed |
| Same-origin Vite production build after final changes | Passed |
| Migration integrity | All 53 original SHA-256 hashes unchanged; V1–V53 in Git index; exactly 51 SQL + 2 Java migrations packaged |
| Broader frontend suite | 209 tests: 190 passed, 18 failed, 1 cancelled by timeout |

The broad frontend run predates the final isolated PDF-lifetime test and one printing-mock correction. That printing failure subsequently passed its focused retest; **17 other failures and one timeout remain unresolved**. They include customer/GRN/inventory assertions, a missing POS component referenced by a test, layout/status expectations, and API-error tests. The supplemental frontend-test-blockers report records every failure and distinguishes the corrected print mock. Some failures may be fixture/timing problems; not all were root-caused in this scoped patch. No unrelated feature assertions were removed or weakened.

The full backend suite was not rerun in this scoped preparation; CI is configured to run it. CI uses two frontend workers, per-test timeouts and forced runner exit after results to prevent leftover test handles from hanging the job. These settings preserve failing assertion exit codes. The proposed release is **blocked** until the broader suite is green on the exact reviewed release tree.

## Remaining deployment checks

- Real domain, certificate paths, NGINX syntax check, HTTPS CORS/cookies, frontend asset-pool layout, SSE and native PDF/printing QA.
- Verify RDS grants as both users and populate a protected environment file plus verified RDS CA truststore; no AWS grants or TLS handshake were checked here.
- Confirm single-instance limits and resource monitoring on the approximately 2 GB host. Keep the existing conservative 512 MB JVM heap initially; perform representative report/export and office-login load tests.
- Existing public signup responses intentionally disclose duplicate registration fields, and password-reset lookup exposes account existence/masked email. The login hardening does not redesign those workflows; review them before unrestricted public access.
- Existing profile password change has a weaker minimum-length check than registration. Review password-change/reset policy consistency separately before public access.
- The local `.env.example` credential fields have been replaced with placeholders. Local `application.yml` still has development credential/signing defaults; these were preserved to avoid changing the running local setup. Production overrides them with required environment variables. Review their history/values privately and keep the prod profile mandatory for staging; do not treat this preparation as a full repository secret-history scan.
- The staged migration additions and untracked production/security files are not yet a committed release. No actual staging deployment is authorized by this document.
- The untracked `frontend/public/warehouse-design-preview.html` is copied into production dist by Vite. Review whether that preview belongs in the release; it has been preserved for your review.
