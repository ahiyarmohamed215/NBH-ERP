-- ==============================================================================
-- NBH ERP: Standalone Super Administrator & System Permissions SQL Seed Script
-- ==============================================================================
-- Run this script directly in MySQL Workbench or mysql CLI if you want to bypass
-- Spring Boot DataInitializer and create the Super Administrator manually.
--
-- Note on Password Hashing:
-- Spring Security requires BCrypt-encoded passwords.
-- The hash below is for password: "admin123"
-- Hash: $2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.AQubh4a
-- ==============================================================================

USE nbhdb;

-- 1. Insert System Permissions (Required for @PreAuthorize & Frontend Roles UI)
INSERT INTO permissions (name, module, description, created_at, updated_at) VALUES
('USER_VIEW', 'USER', 'View user accounts and profiles', NOW(), NOW()),
('USER_MANAGE', 'USER', 'Create, edit, approve, and deactivate system users', NOW(), NOW()),
('ROLE_VIEW', 'ROLE', 'View roles and assigned permissions', NOW(), NOW()),
('ROLE_MANAGE', 'ROLE', 'Create and modify roles and permission sets', NOW(), NOW()),
('WAREHOUSE_VIEW', 'WAREHOUSE', 'View warehouse facilities and locations', NOW(), NOW()),
('WAREHOUSE_MANAGE', 'WAREHOUSE', 'Create and manage warehouses', NOW(), NOW()),
('PRODUCT_VIEW', 'PRODUCT', 'View product catalog, pricing, and specs', NOW(), NOW()),
('PRODUCT_MANAGE', 'PRODUCT', 'Create, edit, and deactivate products', NOW(), NOW()),
('BRAND_VIEW', 'BRAND', 'View product brand listings', NOW(), NOW()),
('BRAND_MANAGE', 'BRAND', 'Create, edit, and manage product brands', NOW(), NOW()),
('CATEGORY_VIEW', 'CATEGORY', 'View product categories', NOW(), NOW()),
('CATEGORY_MANAGE', 'CATEGORY', 'Create and manage categories', NOW(), NOW()),
('SUPPLIER_VIEW', 'SUPPLIER', 'View supplier records and contacts', NOW(), NOW()),
('SUPPLIER_MANAGE', 'SUPPLIER', 'Create and manage suppliers', NOW(), NOW()),
('CUSTOMER_VIEW', 'CUSTOMER', 'View customer master and credit limits', NOW(), NOW()),
('CUSTOMER_MANAGE', 'CUSTOMER', 'Create, edit, and manage customers', NOW(), NOW()),
('INVENTORY_VIEW', 'INVENTORY', 'View stock balances across warehouses', NOW(), NOW()),
('INVENTORY_MANAGE', 'INVENTORY', 'Manage inventory movements and stocks', NOW(), NOW()),
('INVENTORY_ADJUST', 'INVENTORY', 'Perform and approve stock count adjustments', NOW(), NOW()),
('INVENTORY_COST_VIEW', 'INVENTORY', 'View inventory and product cost prices', NOW(), NOW()),
('GRN_VIEW', 'GRN', 'View Goods Received Notes from suppliers', NOW(), NOW()),
('GRN_PROCESS', 'GRN', 'Create and process incoming GRNs into stock', NOW(), NOW()),
('GTN_VIEW', 'GTN', 'View Goods Transfer Notes between warehouses', NOW(), NOW()),
('GTN_PROCESS', 'GTN', 'Process inter-warehouse inventory transfers', NOW(), NOW()),
('PRN_VIEW', 'PRN', 'View Purchase Return Notes to suppliers', NOW(), NOW()),
('PRN_PROCESS', 'PRN', 'Process returns and decrease stock to suppliers', NOW(), NOW()),
('SALES_CREATE', 'SALES', 'Issue POS customer invoices and bills', NOW(), NOW()),
('SALES_VIEW', 'SALES', 'View sales invoices and transaction histories', NOW(), NOW()),
('SALES_VIEW_ALL', 'SALES', 'View sales invoices across all branches and cashiers', NOW(), NOW()),
('SALES_VOID', 'SALES', 'Void completed invoices and restore inventory', NOW(), NOW()),
('SALES_RETURN', 'SALES', 'Process customer returns and issue credit notes', NOW(), NOW()),
('QUOTATION_VIEW', 'QUOTATION', 'View customer sales quotations', NOW(), NOW()),
('QUOTATION_MANAGE', 'QUOTATION', 'Create, edit, delete, and convert quotations to invoices', NOW(), NOW()),
('PAYMENT_CREATE', 'PAYMENT', 'Record customer invoice payments', NOW(), NOW()),
('PAYMENT_VIEW', 'PAYMENT', 'View payment receipts and transaction records', NOW(), NOW()),
('REPORT_VIEW', 'REPORT', 'Access business analytics, sales, and inventory reports', NOW(), NOW()),
('AUDIT_VIEW', 'AUDIT', 'View system security and data change audit logs', NOW(), NOW()),
('DASHBOARD_VIEW', 'DASHBOARD', 'View management dashboard and KPI metrics', NOW(), NOW())
ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW();

-- 2. Insert Super Admin Role
INSERT INTO roles (name, description, created_at, updated_at)
VALUES ('ROLE_SUPER_ADMIN', 'Full unrestricted access across all ERP features', NOW(), NOW())
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 3. Associate All Permissions to ROLE_SUPER_ADMIN
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ROLE_SUPER_ADMIN';

-- 4. Create the Super Administrator User Account
-- Default Username: superadmin
-- Default Password: admin123 (BCrypt hashed)
INSERT INTO users (
    username,
    password,
    email,
    full_name,
    phone,
    employee_code,
    commission_rate,
    approval_status,
    is_active,
    created_at,
    updated_at
) VALUES (
    'superadmin',
    '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.AQubh4a',
    'superadmin@nbh.com',
    'System Super Administrator',
    '+94 11 000 0000',
    'ADM-001',
    0.00,
    'APPROVED',
    1,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    approval_status = 'APPROVED',
    is_active = 1,
    updated_at = NOW();

-- 5. Assign ROLE_SUPER_ADMIN to the superadmin User
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'superadmin' AND r.name = 'ROLE_SUPER_ADMIN';
