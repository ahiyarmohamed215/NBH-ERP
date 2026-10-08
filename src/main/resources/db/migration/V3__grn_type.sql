ALTER TABLE grns ADD COLUMN grn_type VARCHAR(40) NOT NULL DEFAULT 'Standard Inward';
UPDATE grns SET grn_type = 'Import Shipment' WHERE notes LIKE 'Type: Import Shipment |%';
UPDATE grns SET grn_type = 'Direct Purchase' WHERE notes LIKE 'Type: Direct Purchase |%';
UPDATE grns SET grn_type = 'Consignment Intake' WHERE notes LIKE 'Type: Consignment Intake |%';
UPDATE grns SET grn_type = 'Inter-Branch Transfer In' WHERE notes LIKE 'Type: Inter-Branch Transfer In |%';
UPDATE grns SET grn_type = 'Sample / Promotional' WHERE notes LIKE 'Type: Sample / Promotional |%';
