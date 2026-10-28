ALTER TABLE delivery_routes ADD COLUMN status VARCHAR(20) NULL DEFAULT 'ACTIVE';
UPDATE delivery_routes SET status = CASE WHEN is_active = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END;
ALTER TABLE delivery_routes MODIFY COLUMN route_name VARCHAR(100) NULL;

ALTER TABLE deliveries MODIFY COLUMN driver_id BIGINT NULL;
ALTER TABLE deliveries MODIFY COLUMN assistant_staff_id BIGINT NULL;
ALTER TABLE deliveries MODIFY COLUMN scheduled_date DATE NULL;
