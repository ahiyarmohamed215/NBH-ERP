# POS customer assignment

Customer groups may be assigned only to active, approved users with POS access
(SALES_CREATE or the application administrator role). The group editor uses the
POS staff lookup; the server also rejects ineligible staff IDs.

POS loads `/api/v1/customers/pos`. A customer must be active and belong to an
active group assigned to the signed-in staff member. Membership in any active
group grants access; the legacy primary group is also recognized. Customers
without an eligible assignment do not appear. There is no administrator bypass
for this POS assignment rule.

Invoice creation, POS draft updates and held-bill submission recheck assignments.
Changing an ID in a request or revoking an assignment after opening POS cannot
bypass billing restrictions. Office warehouse review and invoicing of previously
submitted bills continue through their existing permissions.

Held-bill copies have an Actions column and Print buttons in the list and popup.
They print saved original quantities, prices and discounts without changing bill
or warehouse-print status. Remarks remain in the popup and the individual bill
printout, rather than the held-bill directory table.
