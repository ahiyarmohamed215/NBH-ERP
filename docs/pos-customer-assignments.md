# POS customer assignment

Customer groups may be assigned only to active, approved users with POS access
(SALES_CREATE or the application administrator role). The group editor uses the
POS staff lookup; the server also rejects ineligible staff IDs.

POS loads `/api/v1/customers/pos`. A customer must be active and belong to an
active group assigned to the signed-in staff member. Membership in an active
group grants access; the legacy primary group is also recognized. Each customer
may belong to only one staff member, while each staff member may have many customers.
Several groups for the same staff member are allowed. Groups assigned to another
staff member cannot share that customer, including inactive groups. Unassigned
groups do not grant POS access. Existing conflicting legacy assignments are excluded
from POS search and billing until corrected; customers are not moved automatically. Customers
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

Group creation and edits validate customer ownership under database locks, including
legacy primary memberships and inactive customers. Creating a customer with groups
for different staff is also rejected. The group editor excludes customers owned by
other staff from its picker and validates existing selections on save. Reassignment
requires removing previous memberships for the old staff member or transferring a
group whose customers have no other staff ownership. Removing a primary group also
clears or replaces its legacy primary pointer. Concurrent assignment requests cannot
successfully assign the same customer to different staff.
