-- Existing sessions receive one transition window; subsequent JWT refreshes never move this deadline.
ALTER TABLE refresh_session ADD COLUMN last_activity_at DATETIME(6) NULL;
UPDATE refresh_session SET last_activity_at = CURRENT_TIMESTAMP(6);
ALTER TABLE refresh_session MODIFY COLUMN last_activity_at DATETIME(6) NOT NULL;
