CREATE TABLE office_printer (id BIGINT PRIMARY KEY, printer_name VARCHAR(255) NOT NULL);
-- Preserve an unambiguous existing shared printer configuration.
INSERT INTO office_printer (id, printer_name)
SELECT 1, MIN(printer_name) FROM warehouse_printers HAVING COUNT(DISTINCT printer_name) = 1;

UPDATE invoices SET status = 'YET_TO_PRINT'
WHERE status = 'SENT_TO_WAREHOUSE' AND EXISTS (
    SELECT 1 FROM held_print_jobs j WHERE j.bill_id = invoices.id AND j.status <> 'SUBMITTED'
    AND j.id = (SELECT MAX(newest.id) FROM held_print_jobs newest
                WHERE newest.bill_id = j.bill_id AND newest.warehouse_id = j.warehouse_id)
);
