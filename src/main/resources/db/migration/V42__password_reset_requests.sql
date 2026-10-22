-- V42: Password reset request support for admin-mediated account recovery
ALTER TABLE users ADD COLUMN password_reset_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN password_reset_notes VARCHAR(255);

