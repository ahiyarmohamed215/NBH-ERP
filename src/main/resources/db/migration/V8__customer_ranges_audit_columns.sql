-- Flyway migration V8: Add missing BaseEntity columns for customer range tables
-- CustomerRangeConfig and CustomerMonthlySummary extend BaseEntity, which requires:
-- record_version, created_at, updated_at, created_by, updated_by

-- 1. customer_range_configs: ensure record_version exists
SET @col_crc_rv = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customer_range_configs' 
      AND COLUMN_NAME = 'record_version'
);
SET @stmt_crc_rv = IF(@col_crc_rv = 0, 
    'ALTER TABLE customer_range_configs ADD COLUMN record_version BIGINT NOT NULL DEFAULT 0', 
    'SELECT 1'
);
PREPARE stmt1 FROM @stmt_crc_rv;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- 2. customer_monthly_summaries: ensure created_by exists
SET @col_cms_cb = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customer_monthly_summaries' 
      AND COLUMN_NAME = 'created_by'
);
SET @stmt_cms_cb = IF(@col_cms_cb = 0, 
    'ALTER TABLE customer_monthly_summaries ADD COLUMN created_by VARCHAR(50) NULL', 
    'SELECT 1'
);
PREPARE stmt2 FROM @stmt_cms_cb;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. customer_monthly_summaries: ensure updated_by exists
SET @col_cms_ub = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customer_monthly_summaries' 
      AND COLUMN_NAME = 'updated_by'
);
SET @stmt_cms_ub = IF(@col_cms_ub = 0, 
    'ALTER TABLE customer_monthly_summaries ADD COLUMN updated_by VARCHAR(50) NULL', 
    'SELECT 1'
);
PREPARE stmt3 FROM @stmt_cms_ub;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
