ALTER TABLE product_staff_quotas ADD COLUMN allocation_status VARCHAR(20);
UPDATE product_staff_quotas SET allocation_status = CASE WHEN is_active = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END;
