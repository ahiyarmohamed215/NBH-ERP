ALTER TABLE invoices ADD COLUMN held_batch_id BIGINT NULL;
CREATE INDEX idx_invoice_held_batch ON invoices (held_batch_id);
