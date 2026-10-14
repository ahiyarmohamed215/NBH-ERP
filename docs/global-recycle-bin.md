# Global recycle bin

Open **Recycle bin** from the sidebar profile menu. It collects deleted products, suppliers, brands, warehouses, categories, inventory allocations, employees, and customers. Search or filter by record type. Entries and actions are limited to the modules the current user can manage.

Deleting from a directory moves the record into the bin and removes it from normal lists and new selections. Confirmation is required. Restore returns its previous active/inactive status; draft products, brands, categories, warehouses, allocations, and suppliers remain drafts. An active allocation can only be restored when its product, employee, and warehouse are active and the required stock is available. Employee deletion revokes existing sessions; restoration requires a new login. Self-deletion and deletion of the protected super administrator are blocked.

Permanent deletion removes the record from the bin, disables restore, and clears descriptive/contact details that are not required for historical records. Identity and business references remain so products, invoices, stock movements, allocation sale counts, and other linked records still resolve. Deleted suppliers retain their name with `(deleted from the system)` wherever referenced; restore removes the label.

All operations are audited. Supported permissions are `PRODUCT_MANAGE`, `SUPPLIER_MANAGE`, `BRAND_MANAGE`, `WAREHOUSE_MANAGE`, `CATEGORY_MANAGE`, `INVENTORY_MANAGE`/`INVENTORY_ADJUST`, `USER_MANAGE`, and `CUSTOMER_MANAGE`, plus their existing edit aliases and administrator access. Transactions such as invoices and GRNs continue using their existing cancellation rules.

Migrations: V24 introduced supplier deletion; V25 adds the shared lifecycle fields to the six additional record types. V27 adds product deletion. Ordinary repository lists exclude deleted records. Direct historical references retain their original IDs, including after permanent deletion.
