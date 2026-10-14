ALTER TABLE suppliers ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE suppliers ADD COLUMN purged_at DATETIME NULL;
ALTER TABLE suppliers ADD COLUMN status_before_delete VARCHAR(20) NULL;
CREATE INDEX idx_suppliers_deleted_at ON suppliers(deleted_at);
