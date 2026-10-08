-- Retire application permissions without deleting historical ledger data.
INSERT INTO permissions (name, module, description, created_at, updated_at)
SELECT 'SUPPLIER_PAYMENT_MANAGE', 'PURCHASING', 'Manage supplier payments and settlements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'SUPPLIER_PAYMENT_MANAGE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions old_grant
JOIN permissions old_permission ON old_permission.id = old_grant.permission_id
CROSS JOIN permissions new_permission
WHERE old_permission.name = 'ACCOUNTING_MANAGE'
AND new_permission.name = 'SUPPLIER_PAYMENT_MANAGE'
AND NOT EXISTS (SELECT 1 FROM role_permissions existing WHERE existing.role_id = old_grant.role_id AND existing.permission_id = new_permission.id);

DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module = 'ACCOUNTING' OR name IN ('ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE'));
DELETE FROM permissions WHERE module = 'ACCOUNTING' OR name IN ('ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE');
