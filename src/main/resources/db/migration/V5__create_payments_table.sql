-- 29. Customer Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_id BIGINT,
    customer_id BIGINT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH', -- CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE
    reference_number VARCHAR(100),
    payment_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, VOIDED
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    CONSTRAINT fk_pmt_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
    CONSTRAINT fk_pmt_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    INDEX idx_pmt_date (payment_date),
    INDEX idx_pmt_customer (customer_id),
    INDEX idx_pmt_invoice (invoice_id),
    INDEX idx_pmt_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
