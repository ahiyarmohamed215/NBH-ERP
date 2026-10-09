-- V5__customer_targets_and_ranges.sql
-- Customer Target Ranges & Progressive Discount System

CREATE TABLE IF NOT EXISTS customer_targets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    target_code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    customer_id BIGINT,
    customer_group_id BIGINT,
    salesman_id BIGINT,
    target_type VARCHAR(30) NOT NULL DEFAULT 'TOTAL_SALES',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reward_type VARCHAR(30) NOT NULL DEFAULT 'PERCENTAGE_DISCOUNT',
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    record_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_cust_target_code UNIQUE (target_code),
    CONSTRAINT fk_cust_target_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_cust_target_group FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE SET NULL,
    CONSTRAINT fk_cust_target_salesman FOREIGN KEY (salesman_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_target_tiers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    target_id BIGINT NOT NULL,
    tier_level INT NOT NULL,
    tier_name VARCHAR(100) NOT NULL,
    min_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    max_amount DECIMAL(15,2),
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reward_description VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_tier_target FOREIGN KEY (target_id) REFERENCES customer_targets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_cust_target_date ON customer_targets(start_date, end_date);
CREATE INDEX idx_cust_target_active ON customer_targets(is_active);
CREATE INDEX idx_tier_target ON customer_target_tiers(target_id);

-- Add permissions for Customer Targets & Ranges
INSERT INTO permissions (name, module, description, created_at, updated_at)
SELECT 'CUSTOMER_TARGET_VIEW', 'CUSTOMER', 'View customer sales targets and discount ranges', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CUSTOMER_TARGET_VIEW');

INSERT INTO permissions (name, module, description, created_at, updated_at)
SELECT 'CUSTOMER_TARGET_MANAGE', 'CUSTOMER', 'Create and configure customer sales targets and discount ranges', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CUSTOMER_TARGET_MANAGE');

-- Grant permissions to Admin / Super Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.name IN ('CUSTOMER_TARGET_VIEW', 'CUSTOMER_TARGET_MANAGE')
AND r.name IN ('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ADMIN', 'SUPER_ADMIN')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
