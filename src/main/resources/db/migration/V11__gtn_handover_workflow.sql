ALTER TABLE gtns ADD COLUMN responsible_staff_id BIGINT NULL;
ALTER TABLE gtns ADD CONSTRAINT fk_gtn_responsible_staff FOREIGN KEY (responsible_staff_id) REFERENCES users(id);
UPDATE gtns SET status = 'TRANSFERRED' WHERE status IN ('RECEIVED', 'COMPLETED');
UPDATE gtns SET status = 'PENDING' WHERE status = 'DISPATCHED';
