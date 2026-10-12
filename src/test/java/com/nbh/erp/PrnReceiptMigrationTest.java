package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PrnReceiptMigrationTest {
    @Test void upgradePreservesLegacyReturnReceiptsAndWarehouses() throws Exception {
        String url="jdbc:h2:mem:prn-receipt-upgrade;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
            sql.execute("create table warehouses (id bigint primary key)");sql.execute("insert into warehouses values (1),(2)");
            sql.execute("create table grns (id bigint primary key)");sql.execute("insert into grns values (10),(20)");
            sql.execute("create table prns (id bigint primary key,source_grn_id bigint,warehouse_id bigint)");sql.execute("insert into prns values (100,10,1),(200,20,2),(300,null,1)");
            sql.execute("create table prn_items (id bigint primary key,prn_id bigint)");sql.execute("insert into prn_items values (1,100),(2,100),(3,200),(4,300)");
        }
        var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("13").target("14").load();
        assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
        try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select source_grn_id,warehouse_id,remarks from prn_items order by id")) {
            for(var pair:new long[][]{{10,1},{10,1},{20,2},{0,1}}) { assertTrue(rows.next());assertEquals(pair[0],rows.getLong(1));assertEquals(pair[1],rows.getLong(2));assertNull(rows.getString(3)); }
            assertFalse(rows.next());
        }
    }
}
