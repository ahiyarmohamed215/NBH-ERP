-- V3__add_all_system_permissions.sql
-- Ensure all system modules have corresponding permissions and assign to ROLE_ADMIN

INSERT INTO permissions (name, module, description)
SELECT 'DASHBOARD_VIEW', 'DASHBOARD', 'View Executive Dashboard, KPIs, and summary metrics'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'DASHBOARD_VIEW');

INSERT INTO permissions (name, module, description)
SELECT 'ROLE_MANAGE', 'ADMINISTRATION', 'Create, configure, and manage company roles and permissions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'ROLE_MANAGE');

-- Group master data permissions under MASTER_DATA
UPDATE permissions SET module = 'MASTER_DATA' WHERE name IN ('WAREHOUSE_MANAGE', 'CUSTOMER_MANAGE', 'SUPPLIER_MANAGE');

-- Group user manage under ADMINISTRATION
UPDATE permissions SET module = 'ADMINISTRATION' WHERE name = 'USER_MANAGE';

-- Assign all permissions to ROLE_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ROLE_ADMIN'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
