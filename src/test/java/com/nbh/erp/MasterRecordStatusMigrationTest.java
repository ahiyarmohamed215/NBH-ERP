package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class MasterRecordStatusMigrationTest {
    @Test void legacyStatusesSurviveAndPartialDraftsCanBeStored() throws Exception {
        String url="jdbc:h2:mem:master-status-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try(var c=DriverManager.getConnection(url,"sa","");var sql=c.createStatement()) {
            sql.execute("create table products(id bigint primary key,name varchar(200) not null,category_id bigint not null,is_active boolean)");
            sql.execute("insert into products values(1,'Active product',1,true),(2,'Inactive product',1,false)");
            for(String table:new String[]{"brands","categories","warehouses"}) {
                sql.execute("create table "+table+"(id bigint primary key,name varchar(150) not null,is_active boolean)");
                sql.execute("insert into "+table+" values(1,'Active',true),(2,'Inactive',false)");
            }
        }
        var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("25").target("26").load();
        assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
        try(var c=DriverManager.getConnection(url,"sa","");var sql=c.createStatement()) {
            for(String type:new String[]{"product","brand","category","warehouse"}) {
                String table=type.equals("category")?"categories":type+"s";
                try(var rows=sql.executeQuery("select "+type+"_status from "+table+" order by id")) {
                    assertTrue(rows.next());assertEquals("ACTIVE",rows.getString(1));assertTrue(rows.next());assertEquals("INACTIVE",rows.getString(1));
                }
                sql.execute("insert into "+table+"(id,name,is_active,"+type+"_status) values(3,null,false,'DRAFT')");
            }
        }
    }
}
