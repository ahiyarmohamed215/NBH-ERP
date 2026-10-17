-- Flyway migration V34: Dashboard Performance Indexes
-- Accelerate recent invoice and GRN ordering and daily sales aggregations

CREATE INDEX idx_inv_created_at ON invoices (created_at);
CREATE INDEX idx_grn_created_at ON grns (created_at);
CREATE INDEX idx_inv_status_date ON invoices (status, invoice_date);
