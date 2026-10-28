ALTER TABLE products ADD COLUMN markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0;

-- Populate existing products with markup from their brand if available
UPDATE products p
JOIN brands b ON p.brand_id = b.id
SET p.markup_percent = COALESCE(b.markup_percent, 0);

-- Drop markup_percent from brands
ALTER TABLE brands DROP COLUMN markup_percent;
