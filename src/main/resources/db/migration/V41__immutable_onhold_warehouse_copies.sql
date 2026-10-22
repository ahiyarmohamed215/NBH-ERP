ALTER TABLE invoices ADD COLUMN original_held_snapshot LONGTEXT NULL;
ALTER TABLE invoices ADD COLUMN original_held_total DECIMAL(19,2) NULL;
ALTER TABLE invoices ADD COLUMN original_held_captured_at DATETIME(6) NULL;
ALTER TABLE invoices ADD COLUMN original_held_sent_at DATETIME(6) NULL;
ALTER TABLE invoices ADD COLUMN cancellation_reason VARCHAR(1000) NULL;
CREATE INDEX idx_invoice_original_sent ON invoices(original_held_sent_at);
-- Older bills may already have been edited. Do not invent originals from their current values.
