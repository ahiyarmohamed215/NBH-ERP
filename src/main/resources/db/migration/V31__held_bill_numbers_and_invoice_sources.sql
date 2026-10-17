ALTER TABLE invoices MODIFY COLUMN invoice_number VARCHAR(50) NULL;
ALTER TABLE invoices ADD COLUMN held_number VARCHAR(50) NULL,
    ADD COLUMN merged_invoice_id BIGINT NULL,
    ADD CONSTRAINT uk_invoice_held_number UNIQUE (held_number),
    ADD CONSTRAINT fk_held_merged_invoice FOREIGN KEY (merged_invoice_id) REFERENCES invoices(id);

-- Preserve existing held records and references; invoice numbers belong to posted sales.
UPDATE invoices SET held_number=CONCAT('HLD-LEGACY-', id), invoice_number=NULL
WHERE status IN ('HELD','SENT_TO_WAREHOUSE','STOCK_ADJUSTED');
