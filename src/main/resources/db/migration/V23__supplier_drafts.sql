ALTER TABLE suppliers ADD COLUMN supplier_status VARCHAR(20);
UPDATE suppliers SET supplier_status = CASE WHEN is_active = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END;
ALTER TABLE suppliers MODIFY COLUMN name VARCHAR(150) NULL;
