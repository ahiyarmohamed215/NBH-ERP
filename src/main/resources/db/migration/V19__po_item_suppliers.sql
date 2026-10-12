ALTER TABLE purchase_order_item ADD COLUMN supplier_id BIGINT NULL;
UPDATE purchase_order_item SET supplier_id = (SELECT p.supplier_id FROM purchase_orders p WHERE p.id = purchase_order_item.purchase_order_id);
ALTER TABLE purchase_order_item ADD CONSTRAINT fk_po_item_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
CREATE INDEX idx_po_item_supplier ON purchase_order_item(supplier_id);
