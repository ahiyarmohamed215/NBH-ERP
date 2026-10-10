ALTER TABLE brands ADD COLUMN markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0;
ALTER TABLE grn_items ADD COLUMN selling_price DECIMAL(38,2) NULL;
ALTER TABLE grn_items ADD COLUMN markup_percent DECIMAL(9,4) NULL;
ALTER TABLE grn_items ADD COLUMN use_brand_markup BOOLEAN NULL;
