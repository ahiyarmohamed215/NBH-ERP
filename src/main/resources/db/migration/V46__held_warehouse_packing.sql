CREATE TABLE invoice_warehouse_packing (
    invoice_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    boxes INT NOT NULL,
    bags INT NOT NULL,
    p_bags INT NOT NULL,
    others INT NOT NULL,
    PRIMARY KEY (invoice_id, warehouse_id),
    CONSTRAINT fk_iwp_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_iwp_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);
