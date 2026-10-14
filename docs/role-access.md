# Role assignment and module access

Assign roles in Employees. A staff member receives the union of the permissions
on their assigned roles. Removing all roles removes module access. Administrator
roles retain full access; use custom roles for limited access.

The frontend module and tab rules are in `frontend/src/utils/moduleAccess.js`.
Record edit and cost visibility rules are in `permissionUtils.js`. Backend read
and edit rules are in `SecurityUtils`; controller write checks use the specific
workflow permission. Keep these rules aligned when adding a permission.

| Module | View permissions | Action permissions |
| --- | --- | --- |
| Dashboard | `DASHBOARD_VIEW` (also permitted inventory/report views) | Separate billing and GRN permissions for shortcuts |
| Customers | `CUSTOMER_VIEW`, `CUSTOMER_TARGET_VIEW` | `CUSTOMER_MANAGE`, `CUSTOMER_TARGET_MANAGE` |
| Employees and roles | `USER_VIEW`, `ROLE_VIEW` | `USER_MANAGE`, `ROLE_MANAGE` |
| Inventory | `INVENTORY_VIEW`, product/warehouse/brand/category view permissions | `INVENTORY_ADJUST`, `INVENTORY_MANAGE`, each directory's manage permission |
| Purchasing | `SUPPLIER_VIEW`, `GRN_VIEW`, `GTN_VIEW`, `PRN_VIEW` | `SUPPLIER_MANAGE`, `GRN_PROCESS`, `GTN_PROCESS`, `PRN_PROCESS` |
| Sales | `SALES_VIEW`, `SALES_VIEW_ALL`, `QUOTATION_VIEW` | `SALES_CREATE`, `SALES_EDIT`, `SALES_RETURN`, `QUOTATION_MANAGE` |
| Payments | `PAYMENT_VIEW` | `PAYMENT_CREATE` |
| Delivery | `DELIVERY_VIEW` | `DELIVERY_MANAGE` |
| Reports | `REPORT_VIEW`, `AUDIT_VIEW` for the audit tab | Read and export only |

Manage/process/create permissions include reading their own workflow records.
Reference lookups needed by an assigned workflow do not grant unrelated module
navigation or management access. Staff lookup endpoints return assignment labels,
without employee contact details or permission sets.

Role-only changes keep existing sessions valid: every authenticated request loads
current database roles. The frontend refreshes its profile after role/user changes,
on window focus, and every minute. Older profile responses cannot overwrite newer
permissions or restore a logged-out session. Password changes and deactivation
invalidate sessions. API caches are isolated by session and cleared on access changes.

Regression coverage: `RoleAccessIntegrationTest`, `module-access.test.js`,
`role-session.test.js`, and authenticated employee/target/POS workflow tests.
