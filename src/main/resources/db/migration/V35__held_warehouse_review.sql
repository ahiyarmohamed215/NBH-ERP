ALTER TABLE invoice_items ADD COLUMN warehouse_id BIGINT;
UPDATE invoice_items SET warehouse_id = (SELECT i.warehouse_id FROM invoices i WHERE i.id = invoice_items.invoice_id);
ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_item_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE invoices ADD COLUMN assigned_staff VARCHAR(255);
ALTER TABLE invoices ADD COLUMN reviewed_by VARCHAR(255);
ALTER TABLE invoices ADD COLUMN reviewed_at DATETIME;
ALTER TABLE stock_adjustments ADD COLUMN source_held_bill_id BIGINT;
ALTER TABLE stock_adjustments ADD COLUMN source_held_bill_number VARCHAR(255);
ALTER TABLE stock_adjustments ADD CONSTRAINT fk_adjustment_held FOREIGN KEY (source_held_bill_id) REFERENCES invoices(id);
CREATE TABLE warehouse_printers (warehouse_id BIGINT PRIMARY KEY, printer_name VARCHAR(255) NOT NULL,
    CONSTRAINT fk_printer_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id));
CREATE TABLE held_print_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, bill_id BIGINT NOT NULL, warehouse_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL, printer_name VARCHAR(255), error_message VARCHAR(1000),
    content TEXT NOT NULL, created_at DATETIME NOT NULL, submitted_at DATETIME,
    CONSTRAINT fk_print_bill FOREIGN KEY (bill_id) REFERENCES invoices(id),
    CONSTRAINT fk_print_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);
CREATE INDEX idx_held_print_status ON held_print_jobs(status, id);
