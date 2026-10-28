ALTER TABLE quotations
    ADD COLUMN cancel_reason VARCHAR(1000) NULL,
    ADD COLUMN cancelled_at DATETIME NULL,
    ADD COLUMN cancelled_by VARCHAR(100) NULL;
