CREATE TABLE brands (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN brand_id BIGINT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id);

INSERT INTO permissions (name, description, module) VALUES 
('BRAND_VIEW', 'View product brands', 'PRODUCT'),
('BRAND_MANAGE', 'Create, update and delete product brands', 'PRODUCT')
ON DUPLICATE KEY UPDATE name=name;

-- Grant BRAND permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_ADMIN' AND p.name IN ('BRAND_VIEW', 'BRAND_MANAGE')
ON DUPLICATE KEY UPDATE role_id=role_id;
