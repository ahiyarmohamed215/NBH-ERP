ALTER TABLE stock_adjustments ADD COLUMN adjustment_type VARCHAR(20) NOT NULL DEFAULT 'COUNT';
ALTER TABLE stock_adjustment_items ADD COLUMN source_grn_item_id BIGINT NULL,
    ADD CONSTRAINT fk_adjustment_source_grn_item FOREIGN KEY (source_grn_item_id) REFERENCES grn_items(id);
CREATE INDEX idx_adjustment_source_grn_item ON stock_adjustment_items(source_grn_item_id);
