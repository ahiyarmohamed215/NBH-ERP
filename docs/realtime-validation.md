# Realtime update validation — 16 October 2026

## Final focused checks

| Check | Result |
| --- | --- |
| `RealtimeChangesTest` | 3 passed: commit coalescing, rollback suppression, notification failure isolation |
| `RealtimePolicyTest` | 2 passed: Orders permission and cashier ownership/current permissions |
| `RealtimeIntegrationTest` | 2 passed: real HTTP SSE, JWT-only access, JPA publication, live permission revocation and token-version disconnect |
| Selected frontend tests | 15 passed, zero failures |
| `npm run build` | Passed; existing bundle-size advisory remains |

The final frontend batch included `realtime-client`, `realtime-sync`, `po-refresh`,
`pos-mode`, `workspace-navigation`, `role-session`, `module-access`,
`purchasing-forms`, `purchasing-inspection`, and `payments-refunds` tests.
Transport tests exercise fragmented UTF-8/CRLF parsing, header authentication,
reconnection and reconciliation, fallback polling, hidden/offline suspension,
refresh-token rotation, heartbeat timeout and cleanup. Hook tests cover topic
filtering, debounce, serialized refreshes and retained-workspace deferral.

## Broader regression run

The complete backend run executed 182 tests: 178 passed, with four errors in
unchanged migration compatibility tests:

- Three `MigrationTest` cases failed because H2 cannot execute MySQL-specific
  `SET @stmt = IF(...)` syntax in V6.
- One `GrnDestinationMigrationTest` case failed while executing V11.

The existing `RegressionIntegrationTest` (68 tests) and
`RoleAccessIntegrationTest` (9 tests) passed. Both HTTP SSE integration cases
also passed in that broader run. Final focused tests above were rerun against
the final realtime implementation.

The full frontend attempt encountered existing UI assertion failures involving
the range-management header, employee save-draft styling, GRN error-message
expectation, allocation actions and supplier phone formatting. The GRN failure
was reproduced with the newly added realtime hook removed through an isolated
Vite transform. Range, allocation and phone assertions also failed in the
initial baseline run before the frontend realtime implementation.

The master-record lifecycle test exhausted array-buffer/Windows paging memory,
so the complete frontend run could not finish. The initial highly concurrent
baseline also exhausted memory. Subsequent validation used sequential tests,
explicit timeouts and smaller memory limits. A final focused backend attempt
initially could not start during that paging exhaustion; the retry passed.

## Reproduce focused checks

From the repository root, run:

```powershell
$env:MAVEN_OPTS='-Xmx192m'
.\mvnw.cmd -q '-Dtest=RealtimeChangesTest,RealtimePolicyTest,RealtimeIntegrationTest' '-DargLine=-Xmx256m -XX:MaxMetaspaceSize=192m' test
```

From `frontend`, run:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=256'
node --test --test-concurrency=1 --test-timeout=60000 --test-force-exit tests/realtime-client.test.js tests/realtime-sync.test.js tests/po-refresh.test.js tests/pos-mode.test.js tests/workspace-navigation.test.js tests/role-session.test.js tests/module-access.test.js tests/purchasing-forms.test.js tests/purchasing-inspection.test.js tests/payments-refunds.test.js
npm run build
```

See [realtime-updates.md](realtime-updates.md) for authentication, authorization,
proxy settings, polling intervals, connection limits and the single-instance
fanout boundary.
