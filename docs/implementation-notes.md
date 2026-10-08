> Historical document. The accounting module has since been removed; see README.md for the current application.

> Historical implementation report. Subsequent cleanup removed unused code and unfinished navigation; see the current [project layout](../README.md#project-layout).

# Implementation status — 8 October 2026

The original review is preserved in [project review](project-review.md). This file describes the implemented changes and their limits. Changes are local; no production deployment or operational database migration was performed.

## Audit findings

| Original finding | Implemented change |
|---|---|
| 1 — Public PDFs | Authenticated document requests, per-module permissions, invoice ownership checks, authenticated blob downloads. |
| 2 — Defaults/secrets | Mandatory JWT secret/database password, explicit disabled-by-default administrator bootstrap, no fixed deployment password. Existing installations must rotate old credentials. |
| 3–4 — Token security | Active/approval checks, separate access/refresh purposes, token versions, rotating persisted refresh sessions, logout/password/admin-change revocation; URL tokens removed. |
| 5–7 — Authorization | Invoice ownership enforcement, PAYMENT/CATEGORY/SALES_VOID permission alignment, exact frontend role names, privilege-grant ceilings and protected administrators. |
| 8 — Returns | Original line/product validation, cumulative quantity limits under invoice lock, original discounted/taxed valuation, debt reconciliation, refund/credit postings, original COGS on restock. Frontend payload/detail mappings corrected. |
| 9 — Invoice updates | Posted financial fields immutable; held completion always deducts stock/quota and posts debt. Warehouse checkpoints now persist without deducting stock. Bulk completion replaces the frontend's previous cancellation call. |
| 10–12 — Payments/debt | Overpayments rejected, explicit customer/invoice resolution, bounded advance allocations and reversals, customer debt derived from posted invoice balances, enforced credit limits. |
| 13–14 — Duplicate processing/quotas | Document pessimistic locks and optimistic versions, request idempotency for principal financial/stock creates, aggregate duplicate product lines, locked quota consumption. Concurrent GRN test confirms exactly one successful processing operation. |
| 15 — Quotation conversion | Unlinked/empty lines rejected. Stale quoted prices are rejected for explicit correction; arbitrary product substitution removed. |
| 16 — Reports/delivery | COMPLETED, PARTIAL and PAID share posted-sale eligibility. Payment no longer removes a sale from those reports or pending delivery. |
| 17 — Delivery assignment | Server sequences, locked invoice/vehicle assignment, active staff eligibility, exclusive active staff trips and validated dispatch/completion transitions. |
| 18 — API contracts | netTotal and paymentMethod mapping fixed; return quantity/condition/original-line fields corrected; contract regression tests added. |
| 19 — Purchase orders | Persistent order/line APIs and frontend integration, server numbers, validated edit/approve/cancel states, partial GRN linkage. |
| 20 — Downloads | Protected Excel/PDF downloads send bearer headers and release blob URLs. |
| 21 — Truncated lists | Existing locally filtered lists exhaust API pages with stable ordering, including employees/products/returns. This fixes omissions; it is an interim approach, not bounded server-driven table pagination. |
| 22 — Errors | Axios status/response/field errors preserved, timeout, visible global error toast, accessible status/alert roles, asynchronous refresh errors caught. Field-by-field form rendering and dedicated retry states are not universal. |
| 23 — Frontend sessions | Refresh token storage/rotation, single-flight refresh, cross-tab Web Lock, startup profile validation and logout revocation. |
| 24 — Deployment | Database readiness/liveness endpoints, Flyway fresh and additive legacy migrations, default Hibernate validation. |

## New persisted workflows

- Purchase orders with partial receipts and original-GRN purchase returns.
- Advance and credit-note allocation; bounded supplier receipts and exact reversals.
- A baseline accounting ledger: accounts, balanced postings, reversals, fiscal-year close, trial balance, income statement and balance sheet with accumulated earnings. Business transactions post to this ledger. Accounting UI uses stored records instead of sample balances.
- Bank journals can be marked reconciled. This is a manual statement-match flag, not automatic bank statement ingestion/reconciliation.
- Lazy-loaded views and URL hash navigation. Main frontend bundle reduced from about 1,349 kB to 347 kB minified; business date defaults use Asia/Colombo.
- Isolated regression/migration tests, frontend contract tests, CI workflow and environment/setup documentation.

## Verification and rollout limits

- Backend suite passed: 38 executed tests, plus one opt-in schema-export test skipped during ordinary runs. It includes H2-backed transaction and concurrency checks and both migration paths.
- Frontend: six tests passed; production build passed. These are automated contract/build checks, not a full visual, keyboard, responsive or print audit.
- Targeted receipt-cancellation valuation and fractional-cent validation regressions are also verified separately after the final corrections.
- Migration tests use H2 in MySQL compatibility mode. A restored production MySQL copy, representative data volume, historical reconciliation and opening balances are still required before rollout. See [README](../README.md).
- Existing data corruption is not automatically guessed or rewritten. V2 defaults new monetary columns to zero and retains original records; historical returns/allocations require reconciliation before reuse. New ledger postings do not retroactively reconstruct old accounts.

## Remaining product/scale work

These are not represented as completed implementations:

- Full cheque deposit/clear/bounce lifecycle, imported bank statements, expense approval/category workflow and dividend rules. Generic journal kinds alone do not implement these workflows.
- GPS/device ingestion, proof of delivery and partial/failed delivery workflows. These need operating requirements and device/provider integration.
- Email-based password recovery and deployment-level/distributed login throttling. No email delivery provider was configured or used.
- Weighted-average/FIFO inventory costing and historical stock-valuation migration. The existing latest-receipt product cost policy remains; reconcile inventory valuation and the ledger before relying on statutory accounts.
- Bounded server-side pagination for every table, database aggregation for remaining findAll-based reports, and volume/query-count profiling. Current exhaustive-page loading prevents missing records but can be expensive on large datasets.
- Full browser accessibility/print QA, generated API clients, and broader end-to-end coverage of every module.

Do not describe this change as production certification or as completion of every optional module proposed in the review.
