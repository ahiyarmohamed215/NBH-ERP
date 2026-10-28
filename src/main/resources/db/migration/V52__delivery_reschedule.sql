ALTER TABLE deliveries ADD COLUMN reschedule_reason TEXT NULL;
ALTER TABLE deliveries ADD COLUMN rescheduled_date DATE NULL;
ALTER TABLE deliveries ADD COLUMN rescheduled_at TIMESTAMP NULL;
