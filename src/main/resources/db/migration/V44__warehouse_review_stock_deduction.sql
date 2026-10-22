-- Existing reviewed bills retain their reservations and deduct at merge, as before.
-- New reviews issue stock immediately; this marker prevents a second issue at merge.
ALTER TABLE invoices ADD COLUMN stock_deducted BOOLEAN NOT NULL DEFAULT FALSE;
