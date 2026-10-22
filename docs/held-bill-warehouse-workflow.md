# Onhold Bills and office printing

POS keeps the current product list in memory without saving recoverable drafts. **Save Onhold Bill** finishes the working
bill as **Yet to Print**, locks POS editing and opens the **Print Onhold Bill**
popup. The popup lists warehouse names and product counts. **Print All Warehouse
Sheets** opens the browser print dialog with A4 documents; every warehouse starts
on a separate page containing only its products. For example, 25 product lines
split 10 / 5 / 10 produce three warehouse sections. Long sections paginate on A4.

After the staff member checks that all sheets printed, **Printed — Send to
Warehouse** records **Sent to Warehouse**. **Print Later**, closing the popup,
blocked browser popups and print failures leave the bill **Yet to Print**. A
browser cannot detect whether paper actually printed, so opening or closing its
native print dialog never changes the bill status automatically. The print icons
on pending bills reopen this same confirmation popup.

Open **Sales → Onhold Bills** to inspect a bill, filter its products by warehouse,
print A4 sheets, inspect print jobs, or complete a warehouse review.
My bills includes bills created by the current user.
Other bills remain visible using the existing sales workspace policy; mutation
and job endpoints permit sales editors to work across saved bills without assignment.
On opening POS, legacy unpublished bills owned by the current staff member are
cancelled through the service and their reservations released. Other staff's bills
and submitted Onhold bills remain unchanged. There is no Unsubmitted bills page.

An office staff member physically delivers the separately printed sheets to the
warehouses. Warehouse staff mark corrections on paper and return them to the office.
Any staff member with sales-edit access opens **Warehouse Review**, a dedicated page,
and enters the returned corrections. Increase or reduce approved quantities, or use
**Remove** to exclude a product from the final bill. Removed lines can be restored
before saving. At least one approved product must remain.

Warehouse Reviewed confirms the sale for inventory. Saving the review releases the
bill's original reservations and deducts its approved quantities from on-hand stock
in the same transaction. Available stock decreases when quantities increase and
increases when quantities decrease or a product is removed. Other bills retain
their reservations. This creates SALE ledger movements, with the held bill number,
and no Inventory Stock Adjustment records.
Quantity changes remain in the bill audit log, including the product, warehouse,
previous quantity and approved quantity. The original POS copy stays unchanged.
Physical stock corrections belong exclusively to **Inventory → Stock Adjustments**;
the review API rejects physical counts, including requests from older clients.
Saving unchanged quantities also confirms the sale and deducts stock once. A
failed or duplicate review cannot deduct stock again.

After review the displayed status becomes **Warehouse Reviewed**. Only bills in
this state can be selected for **Merge & Create Invoice**. Selected bills must
have the same customer and tax rate; their warehouses may differ. The transaction
creates one unpaid credit invoice with **Payment Pending** and **Delivery Pending**,
records staff allocations once per warehouse without deducting already-issued stock again,
and preserves source bills under **Onhold Bill History**, labelled **Invoice
Created**. The invoice detail lists its source held numbers. Normal credit-limit
checks still apply. Source bills cannot be invoiced twice. Voids and restockable
returns restore stock to each original line's warehouse.

## Printer setup

Connect the office Wi-Fi printer to the cashier's computer using the operating
system's printer settings. In the browser print dialog select that printer,
choose A4 and print all pages. A backend printer driver or server-side queue is
not required. One print job includes the separate warehouse sheets, which office
staff distribute manually. Print a new copy if any sheet is missing, then confirm
all sheets printed successfully. The browser print dialog can also save a PDF.

## Original copies and cancellation

**Sales → Held Bills → POS Onhold Bill** keeps the immutable POS document from
the moment the POS bill is saved. It preserves original products, quantities, prices,
discounts, tax and totals after review, removal of a product, merging and voiding.
This page is read-only; print confirmation and bill changes belong to Onhold Bills.
Search, status, owner and date-range controls use the GRN components. Click a row
for details; tables have no View icon.

Range and target qualification uses sent original held values, excludes cancelled
orders, and excludes their merged invoice from a second count. Unsent bills and
ordinary direct invoices do not qualify. Financial sales revenue and customer debt continue
to use posted invoice values. Returns and invoice voids retain their existing
qualification reversals. Printer submission and cancellation refresh monthly range
summaries after commit; reading progress also recalculates them.

Cancel a saved bill using the same reason dialog as GRN. The server requires the
reason and current record version, records it in the audit log, releases stock
reservations (or restores issued stock for a reviewed sale) and cancels queued/failed print jobs. A bill currently being submitted
to the printer must finish that submission before cancellation. Original copies
remain available as history.

Migration V41 adds immutable snapshot fields and cancellation reasons. It does
not fabricate pre-adjustment values for older reviewed/invoiced bills. Existing
unreviewed sent bills are captured while locked when POS Onhold Bill is opened,
and any remaining unreviewed bill is captured before review. Historical copies
for already-adjusted older bills cannot be recovered from their current lines.

## Permissions and deployment

- `SALES_CREATE`: create POS bills and send owned bills for warehouse review.
- `SALES_EDIT`: record approved quantities, merge reviewed
  bills. Any staff member with `SALES_EDIT` can review and merge saved Onhold bills, regardless of who created them. No responsible-staff assignment is required.
- `INVENTORY_ADJUST`: additionally required when recording physical stock counts.
- Administrators retain their existing permission overrides.

Apply Flyway migration `V35__held_warehouse_review.sql` through the normal deployment
process after rehearsing it on a restored database. It backfills existing invoice
line warehouses from their invoice headers and adds assignment, review, source
adjustment and print queue data. It does not modify historical quantities. Restart
the backend and deploy the frontend together. Printer mappings require one-time
setup on the deployed backend host; physical printer output must be verified there.
The follow-up migration `V37__office_printer_and_onhold_print_status.sql` adds the
single office printer configuration and repairs sent bill statuses where the latest
warehouse jobs have not been submitted. A single shared legacy printer mapping is
retained automatically. It leaves reviewed and invoiced bills unchanged.

Held Bills has only **POS Onhold Bill** and **Onhold Bill Cancelled** status options, plus All Statuses. Invoice creation and cancellation stay in the live Onhold Bills list. Original POS lines and totals remain unchanged when a merged invoice is voided.

## Cancelling a bill after invoicing

Sales editors can cancel an individual merged Onhold bill from Onhold Bills or
from its invoice's **Merged Onhold Bills** table. A reason and current version
are required. The invoice must have no payment or return and delivery must be
Pending with no delivery assignment. Paid, partially paid, scheduled, in-transit
and delivered invoices are blocked with the current status in the error.

Cancellation locks the parent invoice before its source bills, using the same
invoice lock as payment and delivery. It removes exactly the source bill's lines,
restores sold quantities in their original warehouses and staff allocations,
reduces subtotal, discount, tax and balance, and reconciles customer debt in one
transaction. Cancelling the final bill voids the empty invoice. Cancelled source
bills remain historical records and cannot be merged or restored twice. Cancelling the sale reverses its stock movement. Warehouse Review itself
issues approved sale quantities; separate Inventory Stock Adjustments remain independent.

Original POS copies keep their products and values. Their current version and
cancellation reason are supplied separately from the immutable snapshot. Invoice
source lists exclude cancelled bills; original copies and the audit log retain
the link to the invoice for traceability.

POS uses the immutable originals endpoint for its Onhold list, monthly reference
totals and row details. Office-adjusted quantities are not loaded into this view.
Cancelling the source Onhold bill or its merged invoice changes the copy status to Onhold Bill Cancelled; warehouse review and invoice creation leave it as POS Onhold Bill. Original products, quantities and values remain preserved. Range progress labels refer to sent POS bills.

## POS staff performance

The Onhold popup shows original bills. **Performance** opens separately beside
Held Bills in the POS header.
The monthly leaderboard ranks original saved POS values, including bills awaiting
print, excludes cancelled bills and sources whose merged invoice was voided,
and never counts the merged invoice again. Tied amounts share a rank. Active,
approved staff with POS permission appear even with no bills; staff who created
bills during the selected month retain their historical results. Only names and
billing metrics are returned, without account/contact details.

Customer range milestones are credited to the staff member whose sent bill
crosses a positive monthly range threshold. The calculation includes preceding
qualifying sent bills from other staff, and completed returns
can reverse achievements. Base zero-value ranges are excluded. The leaderboard
also shows confirmed amount, waiting-print count, customers and average original
bill value. It refreshes every 30 seconds and supports month selection and staff
search. The range popup combines ranges and targets into one card, with three
goals per page, a GRN-style month filter, and no calculation notes. It uses confirmed values only;
the unsent cart does not affect progress.

Performance is opened directly beside Held Bills in the POS header. The popup shows
only the monthly ranking table: rank, staff, sales value, bills, range achievements
and target achievements. Clicking a staff member opens a compact summary over the
ranking, with those results, their customer-range distribution, the gap to the
next higher rank and comparison with first place. Customer transaction lists,
search tabs, averages and print queues are omitted from the staff summary.

Range progress supports a month parameter (YYYY-MM), defaults to the current
business month and rejects future months. Past months use their own original sent
bill totals. Campaigns overlap the selected month and include qualifying values
only up to that month's end (or today for the current month). Changing the popup
month does not change the POS header's current-month progress.


### Live workflow and immutable POS copies

Onhold Bills is the live workspace for Yet to Print, Sent to Warehouse, Warehouse Reviewed, Onhold Bill Cancelled, Invoice Created and Invoice Cancelled. Creating or cancelling an invoice no longer removes its source bills from this list. Only Warehouse Reviewed bills can be selected for merging; warehouse review remains available from Sent to Warehouse.

Held Bills (including the POS popup) contains only immutable POS originals. It has no edit, cancellation, print-confirmation or alternate invoiced-list actions. Original quantities, products and amounts never refresh from the live invoice; the copy shows only POS Onhold Bill or Onhold Bill Cancelled. Warehouse adjustments and invoice lifecycle statuses appear only in Onhold Bills. Range and target calculations continue to use the sent original amount, with cancelled bills/invoices excluded.


### Invoice packing and allocation checks

The merge confirmation requires Box, Bag, P. Bag and Others quantities (whole numbers from 0 to 1000000; enter 0 when unused). The API validates all four before performing the merge, persists them on the invoice, and returns them in invoice details and summaries. The confirmation remains open on failure with an inline error and the entered counts intact.

Quota consumption now respects the same unrestricted result as the POS allocation check: a staff member with no effective allocation does not require a quota deduction. Existing active allocation limits remain enforced under lock, and only allocations valid on the sale date are consumed. This fixes the generic Staff quota exceeded error caused by attempting to consume an empty allocation list.


### POS stock counts for allocated staff

The POS catalog uses the signed-in staff member's stock limits. Allocated products show remaining sellable allocation, capped by available physical stock. Products without an applicable allocation use available physical stock. Warehouse allocations are used before shared product allocations; a shared allocation is counted once across warehouses. Cart quantities reduce the displayed count immediately.

The POS stock-limits endpoint requires Sales access and returns only the current staff member's limits. Existing pending Onhold quantities are deducted before returning limits. Creating or saving a POS held bill validates the full requested product/warehouse quantities under a staff-row lock, excluding the current bill on retry. This prevents multiple saved bills or concurrent POS sessions from reusing the same remaining allocation. Cancelling a bill releases its pending quantity. Merging replaces pending quantities with the existing sold-allocation accounting, without charging the office staff's allocation.

When allocation lookup fails, POS shows a retry message and blocks adding/saving instead of falling back to unrestricted stock. Limits refresh on inventory/sales changes and periodically while POS is open.


### Allocation is enforced at POS, not office invoice creation

The office merge path records sold allocation quantities without revalidating allocation capacity. A quota reduced, exhausted, expired or removed after the POS submission cannot block creating an invoice from already adjusted bills. Actual sold quantities remain recorded for effective allocations, even if they exceed a subsequently reduced allocation; remaining POS availability stays at zero. Direct invoice flows retain their existing validation. Customer credit, reviewed-only selection, common customer and bill version checks still apply to warehouse merges. Already-issued stock is not rechecked or deducted again; legacy reviewed reservations are released and issued at merge.


### Increasing warehouse-approved quantities

Onhold stock review may increase an existing product quantity. Its maximum is the original POS creator's remaining allocation excluding this bill, and the warehouse stock available to this bill. Other pending bills and approved lines share the same allocation; another bill's reservations cannot be reused. The editor displays each line's current maximum and disables over-limit saves. The backend repeats these checks transactionally and rolls back failed reviews. Unallocated products are capped by warehouse stock. Original POS copies remain unchanged, and office invoice creation still does not revalidate allocation capacity.


### Customer credit controls in POS

A zero or unset customer credit limit means no credit cap; the POS credit card and account popup show No limit for that customer. Positive limits show a warning when outstanding dues reach the limit or the current bill exceeds available credit. Products can still be added and Onhold bills saved, sent to the warehouse, and reviewed. The backend checks credit when creating the final invoice, including office merges. Payment refresh or raising the customer limit restores available billing capacity. Paying a balance changes available credit, not the configured limit.

### Warehouse review stock posting

Migration V44 adds `invoices.stock_deducted`, default false. New warehouse reviews
set this marker after issuing approved stock and clearing reservations. Merge
transfers the already-issued quantities to the consolidated invoice without a
second stock deduction. Cancellation before merge restores the reviewed quantities;
source cancellation after merge and invoice void restore each quantity once through
their existing reversal paths. Customer debt, payment and dispatch continue to use
the consolidated invoice.

Existing reviewed bills are left unchanged by migration, retaining their original
reservations. Their stock is deducted once when merged. A merge can contain both
legacy reserved bills and new already-issued bills. Deployment requires the V44
migration and backend restart; no stock is reposted during migration.
