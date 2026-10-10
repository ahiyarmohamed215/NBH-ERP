ALTER TABLE grn_items ADD COLUMN warehouse_id BIGINT NULL;

-- Preserve the original receipt destination, even if a product has since moved.
UPDATE grn_items SET warehouse_id = (SELECT warehouse_id FROM grns WHERE grns.id = grn_items.grn_id);

CREATE INDEX idx_grn_items_warehouse ON grn_items (warehouse_id);
ALTER TABLE grn_items ADD CONSTRAINT fk_grn_item_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id);
