ALTER TABLE vehicles ADD COLUMN assigned_staff_id BIGINT NULL;
ALTER TABLE vehicles ADD CONSTRAINT fk_vehicle_assigned_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id);
CREATE INDEX idx_vehicle_assigned_staff ON vehicles(assigned_staff_id);
