-- Flyway migration V7: Performance Indexes
-- Targets verified slow query paths, customer searches, invoice aggregations, and stock queries

-- Invoices: composite indexes for customer billing lookups, cashier reporting, and warehouse views
CREATE INDEX idx_inv_customer_date ON invoices (customer_id, invoice_date);
CREATE INDEX idx_inv_sales_rep_status ON invoices (sales_rep_id, status);
CREATE INDEX idx_inv_warehouse_status ON invoices (warehouse_id, status);

-- Invoice items: fast product revenue aggregations and return lookups
CREATE INDEX idx_inv_items_product ON invoice_items (product_id);

-- Customers: fast search by active status, name prefix, and phone
CREATE INDEX idx_cust_active_name ON customers (is_active, name);
CREATE INDEX idx_cust_phone ON customers (phone);

-- Product staff quotas: fast check for active allocation
CREATE INDEX idx_quota_user_active ON product_staff_quotas (user_id, is_active);

-- Stock balances: fast lookup by product across all warehouses
CREATE INDEX idx_stock_product_id ON stock_balances (product_id);
