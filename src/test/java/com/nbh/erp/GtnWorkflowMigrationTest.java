package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class GtnWorkflowMigrationTest {
    @Test void upgradePreservesDraftsAndNormalizesCompletedTransfers() throws Exception {
        String url = "jdbc:h2:mem:gtn-workflow-upgrade;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.execute("create table users (id bigint primary key)");
            sql.execute("create table gtns (id bigint primary key, status varchar(30))");
            sql.execute("insert into users values (1)");
            sql.execute("insert into gtns values (1,'RECEIVED'),(2,'DRAFT'),(3,'DISPATCHED'),(4,'CANCELLED')");
        }
        var flyway = Flyway.configure().locations("classpath:db/migration").dataSource(url, "sa", "").baselineOnMigrate(true).baselineVersion("10").target("11").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            try (var rows = sql.executeQuery("select status from gtns order by id")) {
                for (String status : new String[]{"TRANSFERRED", "DRAFT", "PENDING", "CANCELLED"}) { assertTrue(rows.next()); assertEquals(status, rows.getString(1)); }
            }
            sql.execute("update gtns set responsible_staff_id=1 where id=1");
            assertThrows(java.sql.SQLException.class, () -> sql.execute("update gtns set responsible_staff_id=999 where id=1"));
        }
    }
    @Test void statusReasonUpgradePreservesExistingTransfers() throws Exception {
        String url="jdbc:h2:mem:gtn-reason-upgrade;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
            sql.execute("create table gtns (id bigint primary key, status varchar(30))");sql.execute("insert into gtns values (1,'TRANSFERRED')");
        }
        var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("11").target("12").load();
        assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select status,last_status_reason from gtns")) {
            assertTrue(rows.next());assertEquals("TRANSFERRED",rows.getString(1));assertNull(rows.getString(2));
        }
    }
    @Test void itemRouteUpgradePreservesEveryLegacyHeaderRoute() throws Exception {
        String url="jdbc:h2:mem:gtn-item-routes;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
            sql.execute("create table warehouses (id bigint primary key)");sql.execute("insert into warehouses values (1),(2),(3)");
            sql.execute("create table gtns (id bigint primary key,source_warehouse_id bigint,destination_warehouse_id bigint)");sql.execute("insert into gtns values (10,1,2),(20,3,1)");
            sql.execute("create table gtn_items (id bigint primary key,gtn_id bigint)");sql.execute("insert into gtn_items values (100,10),(101,10),(200,20)");
        }
        var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("12").target("13").load();
        assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select source_warehouse_id,destination_warehouse_id from gtn_items order by id")) {
            for(var route:new long[][]{{1,2},{1,2},{3,1}}) { assertTrue(rows.next());assertEquals(route[0],rows.getLong(1));assertEquals(route[1],rows.getLong(2)); }
        }
    }
}
