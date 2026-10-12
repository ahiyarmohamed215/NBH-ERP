ALTER TABLE purchase_order_item ADD COLUMN warehouse_id BIGINT NULL;
UPDATE purchase_order_item SET warehouse_id = (SELECT p.warehouse_id FROM purchase_orders p WHERE p.id = purchase_order_item.purchase_order_id);
ALTER TABLE purchase_order_item ADD CONSTRAINT fk_po_item_delivery_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
CREATE INDEX idx_po_item_delivery_warehouse ON purchase_order_item(warehouse_id);
