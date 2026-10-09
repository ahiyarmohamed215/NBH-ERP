-- Migration V6: Customer Monthly Range & Target Management
-- Provides global configurable purchase ranges, monthly customer summaries, and audit logging

CREATE TABLE IF NOT EXISTS customer_range_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    range_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    min_spend DECIMAL(38, 2) NOT NULL,
    display_order INT NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    description VARCHAR(255),
    created_at DATETIME(6) NOT NULL,
    created_by VARCHAR(50),
    updated_at DATETIME(6),
    updated_by VARCHAR(50),
    CONSTRAINT uk_range_min_spend UNIQUE (min_spend),
    CONSTRAINT chk_range_min_spend_nonneg CHECK (min_spend >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_monthly_summaries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    qualifying_purchases DECIMAL(38, 2) NOT NULL DEFAULT 0.00,
    invoice_count INT NOT NULL DEFAULT 0,
    current_range_id BIGINT NOT NULL,
    highest_range_achieved_id BIGINT NOT NULL,
    last_purchase_date DATE,
    last_invoice_id BIGINT,
    assigned_staff_id BIGINT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    record_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_cust_month UNIQUE (customer_id, year_month),
    CONSTRAINT fk_cms_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_cms_curr_range FOREIGN KEY (current_range_id) REFERENCES customer_range_configs(id),
    CONSTRAINT fk_cms_high_range FOREIGN KEY (highest_range_achieved_id) REFERENCES customer_range_configs(id),
    CONSTRAINT fk_cms_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id),
    INDEX idx_cms_month_range (year_month, current_range_id),
    INDEX idx_cms_staff_month (assigned_staff_id, year_month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_range_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    target_id BIGINT,
    details TEXT,
    performed_by VARCHAR(50),
    performed_at DATETIME(6) NOT NULL,
    INDEX idx_cral_type (action_type)
) ENGINE=InnoDB;

-- Add direct assigned_staff_id column to customers table if not already existing
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customers' 
      AND COLUMN_NAME = 'assigned_staff_id'
);

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE customers ADD COLUMN assigned_staff_id BIGINT NULL, ADD CONSTRAINT fk_customers_assigned_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id)', 
    'SELECT 1'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed default initial customer purchasing ranges (editable by Admin)
INSERT IGNORE INTO customer_range_configs (range_code, name, min_spend, display_order, is_active, description, created_at, created_by)
VALUES 
('RANGE_0', 'Range 0', 0.00, 0, 1, 'Default starting tier for all customers with 0 qualifying purchases', NOW(), 'SYSTEM'),
('RANGE_1', 'Range 1', 50000.00, 1, 1, 'Bronze tier purchasing target (Rs. 50,000)', NOW(), 'SYSTEM'),
('RANGE_2', 'Range 2', 150000.00, 2, 1, 'Silver tier purchasing target (Rs. 150,000)', NOW(), 'SYSTEM'),
('RANGE_3', 'Range 3', 300000.00, 3, 1, 'Gold tier purchasing target (Rs. 300,000)', NOW(), 'SYSTEM'),
('RANGE_4', 'Range 4', 500000.00, 4, 1, 'Platinum tier purchasing target (Rs. 500,000)', NOW(), 'SYSTEM'),
('RANGE_5', 'Range 5', 1000000.00, 5, 1, 'Diamond VIP purchasing target (Rs. 1,000,000)', NOW(), 'SYSTEM');
