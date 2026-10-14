ALTER TABLE products ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE products ADD COLUMN purged_at DATETIME NULL;
ALTER TABLE products ADD COLUMN status_before_delete VARCHAR(20) NULL;
ALTER TABLE products ADD COLUMN active_before_delete BOOLEAN NULL;
