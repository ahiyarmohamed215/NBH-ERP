-- V4__add_sales_view_all_permission.sql
-- Add SALES_VIEW_ALL permission for supervising sales billing, held bills, and user sales accounting

INSERT INTO permissions (name, module, description)
SELECT 'SALES_VIEW_ALL', 'SALES', 'Supervise and view all users sales invoices, held bills, and cashier accounting'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'SALES_VIEW_ALL');

-- Assign SALES_VIEW_ALL to ROLE_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ROLE_ADMIN' AND p.name = 'SALES_VIEW_ALL'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
