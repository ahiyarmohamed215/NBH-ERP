package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class GrnDestinationMigrationTest {
    @Test void markupUpgradeDefaultsExistingBrandsAndKeepsOldReceiptPricesUnset() throws Exception {
        String url = "jdbc:h2:mem:grn-markup;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE brands (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE grn_items (id BIGINT PRIMARY KEY)");
            statement.execute("INSERT INTO brands VALUES (1)");
            statement.execute("INSERT INTO grn_items VALUES (1)");
        }
        var flyway = Flyway.configure().dataSource(url, "sa", "").baselineOnMigrate(true).baselineVersion("9").target("10").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT markup_percent FROM brands")) { assertTrue(rows.next()); assertEquals(0, rows.getBigDecimal(1).signum()); }
            try (var rows = statement.executeQuery("SELECT selling_price, markup_percent, use_brand_markup FROM grn_items")) {
                assertTrue(rows.next()); assertNull(rows.getObject(1)); assertNull(rows.getObject(2)); assertNull(rows.getObject(3));
            }
        }
    }
    @Test void upgradePreservesExistingReceiptDestinationsAndRestarts() throws Exception {
        String url = "jdbc:h2:mem:grn-destinations;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE warehouses (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE grns (id BIGINT PRIMARY KEY, warehouse_id BIGINT NOT NULL)");
            statement.execute("CREATE TABLE grn_items (id BIGINT PRIMARY KEY, grn_id BIGINT NOT NULL)");
            statement.execute("INSERT INTO warehouses VALUES (10), (20)");
            statement.execute("INSERT INTO grns VALUES (1, 10), (2, 20)");
            statement.execute("INSERT INTO grn_items VALUES (1, 1), (2, 1), (3, 2)");
        }
        var flyway = Flyway.configure().dataSource(url, "sa", "").baselineOnMigrate(true).baselineVersion("8").target("9").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT warehouse_id FROM grn_items ORDER BY id")) {
            assertTrue(rows.next()); assertEquals(10, rows.getLong(1));
            assertTrue(rows.next()); assertEquals(10, rows.getLong(1));
            assertTrue(rows.next()); assertEquals(20, rows.getLong(1));
        }
    }
}
