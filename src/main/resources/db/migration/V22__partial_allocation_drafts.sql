ALTER TABLE product_staff_quotas MODIFY COLUMN product_id BIGINT NULL;
ALTER TABLE product_staff_quotas MODIFY COLUMN user_id BIGINT NULL;
ALTER TABLE product_staff_quotas MODIFY COLUMN allocated_quantity DECIMAL(12,2) NULL;
UPDATE product_staff_quotas SET allocation_status = 'INACTIVE', is_active = FALSE WHERE allocation_status = 'CANCELLED';
