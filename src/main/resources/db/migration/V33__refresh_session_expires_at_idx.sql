-- Flyway migration V33: Index on refresh_session expires_at for efficient cleanup of expired sessions
CREATE INDEX idx_refresh_session_expires_at ON refresh_session (expires_at);
