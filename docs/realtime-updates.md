# Realtime updates

The Spring MVC backend provides `GET /api/v1/events` (`text/event-stream`). It uses
the existing access JWT in the Authorization header, JWT version validation,
database user lookup and CORS rules. Tokens are never placed in stream URLs.
The React root owns one fetch-based stream per signed-in browser tab. No new
frontend state library, database tables or migrations are required.

## Publication and authorization

JPA lifecycle callbacks on ERP entities accumulate topic invalidations in the
current Spring transaction. One transaction synchronization coalesces duplicates;
only its `afterCommit` callback queues notifications. Rollbacks produce no events.
This follows Spring's [transaction synchronization contract](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html).
Nested transactions suspend and restore their own accumulator. Direct native SQL,
bulk JPQL updates and external database writers bypass JPA callbacks; reconciliation
still fetches those changes. New bulk workflows should call `RealtimeChanges.changed`
inside their transaction explicitly.

Frames contain only `{"topics":["orders"]}`. They contain no record identifiers,
actions, usernames, customer information, stock quantities or financial values.
The stream checks current database account state, token version and permissions
before delivering each batch and at heartbeat intervals. Orders require the same
`SUPPLIER_MANAGE` permission as their existing controller. Sales notifications are
restricted to the creating cashier or users allowed to view all sales. All actual
records are fetched through the unchanged APIs and their resource-level checks.
User/role hints tell signed-in clients to reconcile their own profile, without
disclosing the changed account or role.

Socket writes occur on a bounded worker pool, outside mutation transactions.
Connections have bounded lifetime (five minutes or access-token expiry, whichever
comes first), 15-second heartbeats, bounded pending sets and cleanup on completion,
errors, timeout and shutdown. Limits are 256 connections per process and six per
account (allowing several browser tabs). Saturated or slow streams reconnect and
reconcile. Rejected connections use the same client polling fallback.

## Frontend synchronization

`RealtimeSync` extends the existing Axios cache and ERP event bus. `useDataSync`
debounces invalidations for 250 ms, filters relevant topics, serializes its refresh
callbacks and retains a pending refresh for hidden workspaces. Nested purchasing
tabs inherit the enclosing module's activity. Existing editor state stays mounted.
There is no server record payload to overwrite an unsaved editor.

Every successful connection emits `ready`, causing an API reconciliation. There
is deliberately no replay history: authoritative GETs repair any missed events,
including after a server restart. The transport uses exponential backoff with
jitter (approximately 1–60 seconds), reuses the existing session refresh on 401,
and aborts silent streams after 45 seconds. Hidden/offline tabs stop streaming
and polling. Returning tabs reconnect; the hook also refreshes on focus/visibility
after 30 seconds of staleness.

While disconnected, a single scheduler requests reconciliation at most once per
minute. While connected it reconciles every two minutes as an eventual-consistency
safety net. Only mounted active subscribers fetch data; Axios continues coalescing
concurrent GETs. Logout/unmount aborts the stream and removes timers and listeners.
Connections are per browser tab; they are not shared across separate browser tabs.

## Hosting

Reverse proxies must stream `/api/v1/events` without response buffering or caching,
and allow idle/read timeouts longer than the heartbeat interval. The endpoint sends
`X-Accel-Buffering: no` and `Cache-Control: no-store, no-transform`; proxy settings
may still need to honor those headers. Retain HTTPS and the existing allowed origins.

Immediate fanout is process-local. A single backend instance provides immediate
updates to all its users. With multiple replicas, clients on other instances catch
up through the two-minute reconciliation safety net. For immediate cross-replica
fanout, bridge committed topic hints through a shared broker; sticky sessions alone
do not solve cross-instance publication. An outbox is needed if durable notification
delivery becomes a business requirement. This transport provides cache invalidation,
not a durable business-event log.

## Validation

Backend coverage: `RealtimeChangesTest`, `RealtimePolicyTest`, and
`RealtimeIntegrationTest` (real HTTP streaming and JPA entity callbacks).
Frontend coverage: `realtime-client.test.js`, `realtime-sync.test.js`, existing
`po-refresh.test.js`, and module/workspace regression tests. Run frontend tests with
`node --test --test-concurrency=1 tests/*.test.js` on memory-constrained machines.
