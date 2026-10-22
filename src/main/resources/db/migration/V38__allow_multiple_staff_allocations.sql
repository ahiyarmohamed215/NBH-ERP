-- Add index on product_id so foreign key constraint FKtfy73kr30yumldphv20pt6k4n remains satisfied
CREATE INDEX idx_quota_product_id ON product_staff_quotas (product_id);

-- Allow staff members to have multiple inventory allocations for the same product and warehouse
ALTER TABLE product_staff_quotas DROP INDEX uk_prod_user_wh;
