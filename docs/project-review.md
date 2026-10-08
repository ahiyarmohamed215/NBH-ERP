> Historical document. The accounting module has since been removed; see README.md for the current application.

> Historical audit. Implementation has since changed; see [IMPLEMENTATION_NOTES.md](implementation-notes.md) and [README.md](../README.md).

**ERP project review — 8 October 2026**

The project has substantial React and Spring Boot implementations for master data, inventory, sales, purchasing documents, payments, delivery, permissions, and reports. It needs security and transaction-integrity fixes before it can be relied on for production operations. Purchase orders and accounting are major unfinished areas.

This is a source-code and build review, not a certification of the deployed application. Findings below describe code paths; concurrency scenarios still need database-backed reproduction. No application code was changed.

**Verification performed**

- Frontend: `npm run build` passed. Vite reported a large main JavaScript bundle: 1,348.92 kB minified, 262.46 kB gzip.
- Backend: `./mvnw.cmd -DskipTests package` passed, including compilation of 215 application sources and two test classes. Tests were skipped, not passed.
- Existing automated coverage: five stock-engine tests and one application-context test. No frontend test/lint scripts, isolated test database configuration, or CI workflow were found in the repository.
- Database integration tests were not run because the tests use the application's normal datasource configuration and startup initializer. Configure an isolated test database before running them.
- No deployed endpoint calls or browser interaction were performed. Production environment-variable overrides were not inspected.

**Priority definitions**

- P0: address before exposing the application to real users/data.
- P1: address before depending on affected financial or stock workflows.
- P2: planned completeness, reliability, and maintainability work.

**Security and authorization fixes**

1. **P0 — PDF documents are publicly accessible.** `SecurityConfig` permits `/api/v1/pdf/**`; `PdfController` does not enforce permissions, and the generation service has no method authorization. An unauthenticated request can reach invoice, GRN, GTN, customer directory/history, and employee document generation. Require authentication and the same resource permissions as the underlying records. Test unauthenticated, unauthorized, and authorized requests for every PDF route. [SecurityConfig.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/config/SecurityConfig.java:52), [PdfController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/pdf/controller/PdfController.java:21).

2. **P0 — Unsafe bootstrap credentials and signing-key fallback.** Application configuration includes a fixed JWT signing-key fallback and enables initial admin creation with a known password. `render.yaml` explicitly sets the known admin password too. Require production secrets, fail startup if absent, and make bootstrap explicit and temporary. Rotate credentials/signing keys on installations that used these defaults. This is a configuration exposure; actual deployment overrides were not verified. [application.yml](C:/Users/HP/Desktop/erp/src/main/resources/application.yml:36), [render.yaml](C:/Users/HP/Desktop/erp/render.yaml:29).

3. **P1 — Disabling an account does not block its existing JWT.** The JWT filter loads `UserDetails` but constructs authenticated credentials without checking `isEnabled()`. Refresh also skips active/approval checks. Check account state on both paths, and implement session/token revocation for password changes and administrative disablement. [JwtAuthenticationFilter.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/security/jwt/JwtAuthenticationFilter.java:39), [AuthService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/auth/service/AuthService.java:128).

4. **P1 — Access and refresh token purposes are interchangeable.** Refresh tokens carry a `type` claim, but shared validation checks only signature/expiry. The request filter accepts refresh tokens as bearer credentials, and refresh accepts access tokens. Enforce token purpose and add refresh rotation/revocation. Remove query-string bearer-token acceptance and the frontend PDF fallback that puts credentials in URLs. [JwtTokenProvider.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/security/jwt/JwtTokenProvider.java:59), [JwtAuthenticationFilter.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/security/jwt/JwtAuthenticationFilter.java:58), [apiClient.js](C:/Users/HP/Desktop/erp/frontend/src/api/apiClient.js).

5. **P1 — Invoice detail endpoints bypass cashier ownership restrictions.** Search and held-list methods restrict regular users, but GET by ID/number has no method permission and its service methods do not enforce ownership. Any authenticated account can request another invoice directly. Apply shared permission and ownership checks to detail, mutation, and document routes. [InvoiceController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/controller/InvoiceController.java:71), [InvoiceService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/service/InvoiceService.java:125).

6. **P1 — Permissions advertised by the role editor do not match enforcement.** `SALES_VOID` is seeded, but void routes allow `SALES_CREATE`/`SALES_DELETE`, without a service-level void permission or ownership check. Payment routes use sales permissions instead of seeded `PAYMENT_VIEW`/`PAYMENT_CREATE`. Category routes use product permissions instead of seeded category permissions. Centralize a permission matrix and test limited custom roles. Frontend role substring checks also need replacement with exact roles/permissions. [DataInitializer.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/config/DataInitializer.java:68), [InvoiceController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/controller/InvoiceController.java:149), [PaymentController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/payment/controller/PaymentController.java), [permissionUtils.js](C:/Users/HP/Desktop/erp/frontend/src/utils/permissionUtils.js).

7. **P1 — User administrators can assign unrestricted administrator roles.** An account with `USER_MANAGE` can create/update users with any existing role, including administrator roles. There is no ceiling based on the caller's privileges. Separate ordinary user management from privileged role assignment, protect administrator accounts, and audit grants. [UserController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/user/controller/UserController.java:45), [UserService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/user/service/UserService.java:48).

**Backend and transaction-integrity fixes**

8. **P1 — Sales returns trust the submitted product, quantity, and refund price.** The service does not establish that the product/invoice-item belongs to the original invoice, cap cumulative returns to sold quantities, or derive refund value from original discounts/tax. A request can add stock for an unrelated product or repeatedly return the same sale. It also rejects PAID/PARTIAL invoices while only accepting COMPLETED, and adjusts the customer's aggregate balance without reconciling invoice balance. Validate original lines and cumulative returns under a lock; calculate refund/credit centrally and post a matching ledger entry. [SalesReturnService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/salesreturn/service/SalesReturnService.java:77), [CreateSalesReturnRequest.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/salesreturn/dto/CreateSalesReturnRequest.java).

9. **P1 — Invoice updates can bypass stock processing and corrupt financial totals.** A HELD invoice can transition to COMPLETED without an `items` payload, because stock deduction is inside the items-update branch. That branch also omits quota consumption and customer-balance posting. Finalized invoices can have warehouse/customer changed without moving the original stock/debt, and accept client-supplied total, paid, and balance values independently. Use explicit completion/payment/void commands, server-derived totals, and immutable posted financial fields. [InvoiceService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/service/InvoiceService.java:470).

10. **P1 — Overpayments are recorded in full despite a message saying they are capped.** Payment processing logs a warning but adds the complete requested amount to paid amount and subtracts it from customer debt. A 150 payment against a 100 balance can reduce another 50 of customer debt without a corresponding allocation. Reject excess or explicitly allocate it as unapplied credit; preserve the original receipt amount separately from invoice allocations. [PaymentService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/payment/service/PaymentService.java:93).

11. **P1 — Advances, customer resolution, and payment voiding are inconsistent.** An unknown invoice number can fall through into a direct payment; unmatched customers can fall back to the walk-in/first customer. An advance reduces existing aggregate debt without allocating it to invoices. Voiding always adds the entire payment to debt, even when creation did not subtract that amount. Require explicit valid customer/invoice IDs, distinguish advances from invoice allocations, and reverse exactly the ledger entries originally posted. [PaymentService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/payment/service/PaymentService.java:65), [PaymentService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/payment/service/PaymentService.java:189).

12. **P1 — Credit limits are not enforced and some debt is not recorded.** Invoice creation only increments customer debt when `creditLimit > 0`; it never compares resulting debt against that limit. A zero-limit credit invoice can remain outstanding without updating customer balance, and a positive limit can be exceeded. Define zero-limit semantics, enforce credit policy, and post every valid outstanding amount. [InvoiceService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/service/InvoiceService.java:289).

13. **P1 — Document processing is vulnerable to concurrent duplicate actions.** Stock rows have locking/versioning, which is good, but GRN document reads and status transitions do not. Two requests can both observe DRAFT and both apply its stock movement. Similar state-check patterns exist for returns, transfers, payment voids, and quotation conversion. Lock/version each business document, use atomic transitions and retry/idempotency keys, and ensure a document line's movement cannot be posted twice. Confirm with concurrent MySQL integration tests. [GrnService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/grn/service/GrnService.java:190), [GrnRepository.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/grn/repository/GrnRepository.java), [BaseEntity.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/common/entity/BaseEntity.java).

14. **P1 — Staff quota validation can be bypassed with duplicate product lines.** Creation validates each line before any quota is consumed. Two lines of 6 each pass a remaining quota of 10 independently; consumption simply increments totals without checking the limit again. Aggregate by product/staff/warehouse, validate and consume under the same lock, and cover simultaneous sales. [InvoiceService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/service/InvoiceService.java:168), [ProductStaffQuotaService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/inventory/service/ProductStaffQuotaService.java).

15. **P1 — Quotation conversion substitutes an arbitrary product.** Missing product links and empty quotations use the first active/available product, then create a real invoice and deduct its inventory. Reject unresolved lines or explicitly model non-stock service lines; retain approved quoted prices through a defined pricing policy. [QuotationService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/quotation/service/QuotationService.java:270).

16. **P1 — Sales reports lose invoices after payment.** Sales summary includes only status COMPLETED; payment changes invoices to PAID/PARTIAL. Receiving money can therefore make a sale disappear from revenue reporting. Delivery's pending-invoice query has the same COMPLETED-only restriction. Separate financial/payment status from lifecycle/delivery status and use shared eligible-status rules. [ReportService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/report/service/ReportService.java:39), [DeliveryService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/delivery/service/DeliveryService.java:62).

17. **P1 — Delivery numbering and assignment need validation.** The number uses today's date but counts records by scheduled date, so the first trips scheduled for two different dates on the same creation day can get the same unique number. Creation also only rejects an invoice whose existing trip is IN_TRANSIT, allowing reassignment from SCHEDULED/DELIVERED trips; missing IDs and invoice lifecycle eligibility are not fully checked. Use the document-sequence service and enforce invoice/vehicle/staff eligibility and exclusive assignment transactionally. [DeliveryService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/delivery/service/DeliveryService.java:101).

**Frontend and API contract fixes**

18. **P1 — Invoice totals display as zero.** The API emits `netTotal`; the sales list maps `inv.totalAmount || 0`. Read the actual DTO field and add a contract test for list/detail/edit/export mappings. Invoice payment method is also displayed/edited in the UI but absent from the invoice DTO/entity and ignored by update logic; model payment allocations/methods explicitly. [InvoicingHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/InvoicingHub.jsx:138), [InvoiceDto.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/sales/dto/InvoiceDto.java:46).

19. **P1 — Purchase orders are not persisted, and editing one crashes.** `persistOrders` only sets React state; there is no purchase-order API/entity/service. Data disappears on reload/unmount. In the edit branch, `sup` and `wh` are accessed before their `const` initialization, causing a ReferenceError. Implement persistence and move supplier/warehouse resolution before both create/edit branches. Numbering should come from the server rather than a fixed 2026 prefix and array length. [PurchaseOrdersView.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/PurchaseOrdersView.jsx:65), [PurchaseOrdersView.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/PurchaseOrdersView.jsx:209).

20. **P2 — Inventory Excel download omits authentication.** `window.open` navigates to the protected export route without the localStorage bearer header, so the normal JWT login cannot authorize the download. Fetch as a blob with an authorization header and download the blob. Do not append the JWT to the URL. [ReportsView.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/ReportsView.jsx:863), [ReportController.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/report/controller/ReportController.java:65).

21. **P2 — Lists silently omit records beyond the first page.** Sales, payments, advances, and quotations request a fixed size of 100 and filter the returned array locally. Search/export/totals consequently operate on a partial dataset. Use API-side filtering/sorting and real pagination; use dedicated server exports for full datasets. Employee lists and product selectors also have fixed limits that need review. [InvoicingHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/InvoicingHub.jsx:124), [EmployeesHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/EmployeesHub.jsx:127).

22. **P2 — Errors lose useful API details and some failures appear as empty screens.** The response interceptor replaces Axios errors with a plain `Error`, dropping status and field-validation details, while callers still inspect `err.response`. Several loaders only log failures. Preserve a typed error with status/code/field errors, show visible retry states, and avoid representing permission/network failures as empty results. Add API timeouts. [apiClient.js](C:/Users/HP/Desktop/erp/frontend/src/api/apiClient.js), [InvoicingHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/InvoicingHub.jsx:145).

23. **P2 — Frontend session management does not use the refresh endpoint.** Login ignores the returned refresh token and expiration immediately logs users out. Implement refresh only after fixing token purpose, rotation, and revocation on the backend. Narrow anonymous auth routes to login/signup/refresh; `/auth/me` and `/auth/profile` should require authentication. [AuthContext.jsx](C:/Users/HP/Desktop/erp/frontend/src/context/AuthContext.jsx), [SecurityConfig.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/config/SecurityConfig.java).

24. **P2 — Deployment health check targets a user-profile endpoint.** `render.yaml` uses `/api/v1/auth/me`. Without a token it cannot resolve an actual user and does not return a healthy success response. Implement a dedicated readiness/liveness endpoint and point hosting checks at it. Add versioned database migrations and change production schema management from `ddl-auto: update` to validation. [render.yaml](C:/Users/HP/Desktop/erp/render.yaml:9), [AuthService.java](C:/Users/HP/Desktop/erp/src/main/java/com/nbh/erp/auth/service/AuthService.java), [application.yml](C:/Users/HP/Desktop/erp/src/main/resources/application.yml:22).

**Missing implementations and proposed API work**

The endpoint names below are proposals, not existing capabilities.

| Area | Current state | What to implement |
|---|---|---|
| Purchase orders | Temporary React state; only a status enum exists on the backend | Persistent order/line entities, DTO validation, permissions, sequence numbers, list/detail/create/edit APIs, approve/cancel commands, partial receipt tracking, PO-to-GRN linkage. Suggested base: `/api/v1/purchase-orders`. |
| Accounting | `AccountingHub` uses `INITIAL_ACCOUNTS` sample balances and Coming Soon screens | Chart of accounts, balanced journal entries, immutable postings/reversals, fiscal periods, trial balance, income statement and balance sheet. Suggested bases: `/accounts`, `/journal-entries`, `/reports/trial-balance`. Integrate sales, purchases, payments, returns and stock valuations. |
| Banking, cheques, expenses | Accounting preview screens | Bank accounts, statement reconciliation, cheque lifecycle/bounce handling, expense categories, approvals and ledger posting. Prioritize these over optional dividend management. |
| Advances and credit notes | Payment/credit-note records exist, but no complete allocation/redemption workflow | Customer ledger, available credit, invoice allocations, refund records and exact reversals. Suggested commands: `/payments/{id}/allocations`, `/credit-notes/{id}/apply`, `/refunds`. |
| Purchase returns/payables | Return document reduces stock but is not reconciled to original receipts or supplier accounts | Link original GRN lines, enforce cumulative return limits, supplier debit notes, supplier balances and payment allocation. |
| Delivery tracking | Real trip create/dispatch/complete APIs; GPS marked Coming Soon | Complete assignment validation first; add partial/failed delivery and proof-of-delivery if required. GPS needs location ingestion, device/driver identity, map UI and operational requirements. |
| Session lifecycle | Login/signup/refresh/profile exist | Correct refresh validation, rotation, logout/revocation, password recovery, login throttling and audit events. |
| Shared API contract | OpenAPI is configured; frontend mappings are handwritten | Generate/check DTO contracts, standardize enums and error payloads, reject invalid referenced IDs, add idempotency for financial mutations, and document allowed state transitions. |

Accounting source: [AccountingHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/AccountingHub.jsx:71). GPS preview source: [DeliveryHub.jsx](C:/Users/HP/Desktop/erp/frontend/src/views/DeliveryHub.jsx:1259).

**Further engineering work**

- Split large views into feature components and lazy-load modules; the initial bundle currently imports all major screens. Add URL-based navigation so refresh/back/bookmarks preserve the current view.
- Define the inventory costing policy. Current receipt handling replaces a product's global cost with the latest supplied cost, and valuations multiply all on-hand units by that value. If accounting needs weighted-average or FIFO valuation, implement cost layers/averages and reversal rules explicitly.
- Replace `findAll()` plus in-memory report filtering with database aggregation and bounded queries; inspect lazy-loading query counts on real-sized datasets.
- Centralize business timezone and date-only handling. Browser `toISOString()` uses UTC, while backend `LocalDate.now()` uses its host timezone; date defaults and daily summaries can disagree near midnight.
- Expand audit coverage to user/role grants and all stock/return transitions; retain before/after values where needed. Keep inventory and financial movement records immutable.
- Add a README, local/backend environment examples, an isolated test profile, migration/bootstrap instructions, backup/restore procedure, and CI checks.
- Validate keyboard access, focus handling, responsive layouts, and print output in a browser after the functional fixes. These were not visually tested in this review.

**Recommended implementation order and acceptance checks**

| Stage | Deliverable | Acceptance checks |
|---|---|---|
| 1 | Secure PDFs/authentication/privileged grants and align permissions | Anonymous PDF requests fail; disabled users and wrong-purpose tokens fail; cashier cannot access another cashier's restricted invoices or void without permission; user managers cannot self-promote. |
| 2 | Shared invoice/payment/return state rules and ledger posting | HELD completion always deducts stock/quota once; return cannot exceed original sale; full/partial payment does not remove sales from reports; creation and reversal reconcile invoice and customer debt. |
| 3 | Concurrency and idempotency | Simultaneous GRN process/void/payment requests cannot double-post or lose balances; duplicate product lines cannot exceed quota; delivery numbers remain unique. |
| 4 | Frontend/API integration corrections | A known invoice total displays correctly; purchase-order editing does not crash; authenticated Excel export succeeds; record 101 is searchable and exportable; validation errors appear next to fields. |
| 5 | Persistent purchasing and credit allocation | Purchase orders survive reload and support partial GRNs; advances/credit notes are allocated and reversed without changing unrelated invoice debt. |
| 6 | Accounting and operational completeness | Every posting balances, subledgers reconcile, migrations run on a fresh database, health checks succeed, and end-to-end workflows run in CI with an isolated database. |

These changes should be implemented as small, independently testable steps. Security and transaction correctness take priority over expanding the preview modules.
