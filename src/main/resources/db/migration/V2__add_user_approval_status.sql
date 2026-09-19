-- V2__add_user_approval_status.sql
-- Adds approval_status column to users table for self-registration approval flow

ALTER TABLE users 
ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED';

-- Existing users are APPROVED. For new signups, application logic assigns PENDING.
