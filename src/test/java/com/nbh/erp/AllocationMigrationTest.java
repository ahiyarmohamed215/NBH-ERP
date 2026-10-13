package com.nbh.erp;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
class AllocationMigrationTest {
 @Test void preservesLegacyActiveAndInactiveAllocations() throws Exception {
  String url="jdbc:h2:mem:allocation-lifecycle;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()){
   sql.execute("create table product_staff_quotas(id bigint primary key,is_active boolean)");sql.execute("insert into product_staff_quotas values(1,true),(2,false)");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("20").target("21").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select allocation_status,is_active from product_staff_quotas order by id")){
   assertTrue(rows.next());assertEquals("ACTIVE",rows.getString(1));assertTrue(rows.getBoolean(2));assertTrue(rows.next());assertEquals("INACTIVE",rows.getString(1));assertFalse(rows.getBoolean(2));
  }
 }
 @Test void partialDraftMigrationAllowsMissingFieldsAndRetiresCancelledStatus() throws Exception {
  String url="jdbc:h2:mem:partial-allocation;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()){
   sql.execute("create table product_staff_quotas(id bigint primary key,product_id bigint not null,user_id bigint not null,allocated_quantity decimal(12,2) not null,is_active boolean,allocation_status varchar(20))");
   sql.execute("insert into product_staff_quotas values(1,1,7,10,false,'CANCELLED'),(2,1,8,10,true,'ACTIVE')");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("21").target("22").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()){
   sql.execute("insert into product_staff_quotas values(3,null,null,null,false,'DRAFT')");
   try(var rows=sql.executeQuery("select allocation_status,is_active from product_staff_quotas order by id")){
    assertTrue(rows.next());assertEquals("INACTIVE",rows.getString(1));assertFalse(rows.getBoolean(2));assertTrue(rows.next());assertEquals("ACTIVE",rows.getString(1));assertTrue(rows.getBoolean(2));assertTrue(rows.next());assertEquals("DRAFT",rows.getString(1));
   }
  }
 }
}
