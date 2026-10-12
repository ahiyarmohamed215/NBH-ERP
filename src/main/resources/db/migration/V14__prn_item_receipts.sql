ALTER TABLE prn_items ADD COLUMN source_grn_id BIGINT NULL;
ALTER TABLE prn_items ADD COLUMN warehouse_id BIGINT NULL;
ALTER TABLE prn_items ADD COLUMN remarks TEXT NULL;
ALTER TABLE prns ADD COLUMN remarks TEXT NULL;
UPDATE prn_items SET source_grn_id = (SELECT p.source_grn_id FROM prns p WHERE p.id = prn_items.prn_id)
WHERE EXISTS (SELECT g.id FROM grns g WHERE g.id = (SELECT p.source_grn_id FROM prns p WHERE p.id = prn_items.prn_id));
UPDATE prn_items SET warehouse_id = (SELECT p.warehouse_id FROM prns p WHERE p.id = prn_items.prn_id);
ALTER TABLE prn_items ADD CONSTRAINT fk_prn_item_receipt FOREIGN KEY (source_grn_id) REFERENCES grns(id);
ALTER TABLE prn_items ADD CONSTRAINT fk_prn_item_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
CREATE INDEX idx_prn_item_receipt ON prn_items(source_grn_id);
CREATE INDEX idx_prn_item_warehouse ON prn_items(warehouse_id);
