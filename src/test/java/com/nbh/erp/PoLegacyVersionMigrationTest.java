package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PoLegacyVersionMigrationTest {
    @Test void legacyVersionDefaultAllowsNewOrdersWithoutChangingExistingVersions() throws Exception {
        String url = "jdbc:h2:mem:po-legacy-version;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.execute("create table purchase_orders (id bigint primary key, version bigint not null, record_version bigint not null default 0)");
            sql.execute("insert into purchase_orders values (1,7,3)");
            assertThrows(java.sql.SQLException.class, () -> sql.execute("insert into purchase_orders(id,record_version) values (2,0)"));
        }
        var flyway = Flyway.configure().locations("classpath:db/migration").dataSource(url, "sa", "")
                .baselineOnMigrate(true).baselineVersion("15").target("16").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.execute("insert into purchase_orders(id,record_version) values (2,0)");
            try (var rows = sql.executeQuery("select version,record_version from purchase_orders order by id")) {
                assertTrue(rows.next());assertEquals(7,rows.getLong(1));assertEquals(3,rows.getLong(2));
                assertTrue(rows.next());assertEquals(0,rows.getLong(1));assertEquals(0,rows.getLong(2));
            }
        }
    }

    @Test void freshSchemasWithoutLegacyVersionRemainUnchanged() throws Exception {
        String url = "jdbc:h2:mem:po-current-version;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.execute("create table purchase_orders (id bigint primary key, record_version bigint not null default 0)");
        }
        var flyway = Flyway.configure().locations("classpath:db/migration").dataSource(url, "sa", "")
                .baselineOnMigrate(true).baselineVersion("15").target("16").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.execute("insert into purchase_orders(id,record_version) values (1,0)");
            try (var columns = connection.getMetaData().getColumns(null, "PUBLIC", "PURCHASE_ORDERS", "VERSION")) {assertFalse(columns.next());}
        }
    }
}
