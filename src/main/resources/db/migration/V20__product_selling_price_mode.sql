ALTER TABLE products ADD COLUMN use_brand_markup BOOLEAN NULL;

-- Recover the most recent processed receipt's pricing choice and selling price.
-- Without receipt pricing, existing explicit prices stay manual and zero-priced
-- products calculate their price from current cost and brand markup.
UPDATE products p
SET use_brand_markup = (
    SELECT COALESCE(i.use_brand_markup, FALSE)
    FROM grn_items i JOIN grns g ON g.id = i.grn_id
    WHERE i.product_id = p.id AND g.status = 'PROCESSED'
      AND (i.use_brand_markup = TRUE OR i.selling_price IS NOT NULL)
    ORDER BY COALESCE(g.updated_at, g.created_at) DESC, g.id DESC, i.id DESC
    LIMIT 1
),
 selling_price = COALESCE((
    SELECT i.selling_price
    FROM grn_items i JOIN grns g ON g.id = i.grn_id
    WHERE i.product_id = p.id AND g.status = 'PROCESSED'
      AND (i.use_brand_markup = TRUE OR i.selling_price IS NOT NULL)
    ORDER BY COALESCE(g.updated_at, g.created_at) DESC, g.id DESC, i.id DESC
    LIMIT 1
), p.selling_price)
WHERE EXISTS (
    SELECT 1 FROM grn_items i JOIN grns g ON g.id = i.grn_id
    WHERE i.product_id = p.id AND g.status = 'PROCESSED'
      AND (i.use_brand_markup = TRUE OR i.selling_price IS NOT NULL)
);
