UPDATE purchase_orders SET status = 'DRAFT' WHERE status = 'PENDING';
UPDATE purchase_orders SET status = 'DRAFT' WHERE status = 'CANCELLED'
 AND NOT EXISTS (SELECT 1 FROM purchase_order_item i WHERE i.purchase_order_id = purchase_orders.id AND i.received_quantity > 0);
UPDATE purchase_orders SET status = 'ORDERED' WHERE status IN ('APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED');
