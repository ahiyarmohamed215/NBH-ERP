package com.nbh.erp;

import org.junit.jupiter.api.Test;
import org.flywaydb.core.Flyway;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class MigrationTest {
    @Test void freshDatabaseMigratesAndCanRestart() throws Exception {
        String url="jdbc:h2:mem:migration-fresh;MODE=MySQL;NON_KEYWORDS=YEAR;DB_CLOSE_DELAY=-1";
        var flyway=Flyway.configure().dataSource(url,"sa","").load();
        assertEquals(3,flyway.migrate().migrationsExecuted);
        assertEquals(0,flyway.migrate().migrationsExecuted);
        try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()) {
            s.executeQuery("select source_grn_id from prns");
            s.executeQuery("select returned_amount, record_version from invoices");
            s.executeQuery("select amount from supplier_payment");
        }
    }
    @Test void baselinedLegacySchemaGetsAdditiveUpgrade() throws Exception {
        String url="jdbc:h2:mem:migration-legacy;MODE=MySQL;NON_KEYWORDS=YEAR;DB_CLOSE_DELAY=-1";
        String schema;
        try(var resource=getClass().getResourceAsStream("/db/migration/V1__initial_schema.sql")) { schema=new String(resource.readAllBytes(),StandardCharsets.UTF_8); }
        // Reproduce the pre-upgrade tables without the newly introduced columns and modules.
        var added=java.util.Set.of("account","journal","journal_line","fiscal_year","refresh_session","idempotency_record","purchase_orders","purchase_order_item","payment_allocation","credit_allocation","supplier_payment");
        try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()) {
            for(String statement:schema.split(";")) {
                statement=statement.trim();
                if(!statement.startsWith("create table")) continue;
                String table=statement.split(" ")[2];
                if(added.contains(table)) continue;
                statement=statement.replaceAll("(?:record_version|token_version) bigint not null, ","")
                    .replaceAll("(?:returned_amount|refund_amount|applied_amount) decimal\\(38,2\\) not null, ","")
                    .replace("payment_method varchar(30), ","").replace("purchase_order_id bigint, ","").replace("source_grn_id bigint, ","");
                s.execute(statement);
            }
            s.execute("insert into brands (is_active,created_at,code,name) values (true,current_timestamp,'LEGACY','Preserved brand')");
        }
        var flyway=Flyway.configure().dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("1").load();
        assertEquals(2,flyway.migrate().migrationsExecuted);
        try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()) {
            try(var rows=s.executeQuery("select name,record_version from brands where code='LEGACY'")) { assertTrue(rows.next());assertEquals("Preserved brand",rows.getString(1));assertEquals(0,rows.getLong(2)); }
            s.executeQuery("select source_grn_id from prns");
            s.executeQuery("select returned_amount,record_version from invoices");
            s.executeQuery("select id from supplier_payment");
        }
    }
}
