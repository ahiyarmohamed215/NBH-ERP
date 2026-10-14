# Supplier recycle bin

Supplier managers can delete suppliers from Purchasing → Supplier List using the delete icon. Deletion excludes the supplier from directories, search, and new supplier selections. Recycle bin offers restore and permanent deletion.

Restore returns the supplier to the status it had before deletion. Deleted suppliers cannot be edited or activated directly. Supplier names in linked GRNs, PRNs, purchase orders, inventory products, supplier payments, and GRN PDFs include `(deleted from the system)`. Restoring automatically removes this label.

Permanent deletion removes the supplier from the recycle bin, erases contact details, and disables restore. A minimal historical identity (ID, supplier code, name) remains to preserve foreign keys, financial records, printing, and operations on existing transactions. No linked transactions or stock movements are deleted. Existing GRN and PO edits can retain their original deleted supplier; new supplier selections exclude deleted entries. Returns and payments continue using their saved transaction references.

Database migration: `V24__supplier_recycle_bin.sql`. Lifecycle actions are recorded in the audit log and require `SUPPLIER_MANAGE` (or administrator access).
