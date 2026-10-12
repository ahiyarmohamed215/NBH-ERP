ALTER TABLE gtn_items ADD COLUMN source_warehouse_id BIGINT NULL;
ALTER TABLE gtn_items ADD COLUMN destination_warehouse_id BIGINT NULL;
UPDATE gtn_items SET source_warehouse_id = (SELECT source_warehouse_id FROM gtns WHERE gtns.id = gtn_items.gtn_id),
                     destination_warehouse_id = (SELECT destination_warehouse_id FROM gtns WHERE gtns.id = gtn_items.gtn_id);
ALTER TABLE gtn_items ADD CONSTRAINT fk_gtn_item_source FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id);
ALTER TABLE gtn_items ADD CONSTRAINT fk_gtn_item_destination FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id);
CREATE INDEX idx_gtn_item_source ON gtn_items(source_warehouse_id);
CREATE INDEX idx_gtn_item_destination ON gtn_items(destination_warehouse_id);
