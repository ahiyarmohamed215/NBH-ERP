package com.nbh.erp;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PoSupplierMigrationTest {
 @Test void backfillsExistingLineSuppliersAndEnforcesSupplierForeignKey() throws Exception {
  String url="jdbc:h2:mem:po-line-supplier;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table suppliers(id bigint primary key)");sql.execute("insert into suppliers values(1),(2)");
   sql.execute("create table purchase_orders(id bigint primary key,supplier_id bigint)");sql.execute("insert into purchase_orders values(10,1),(20,2)");
   sql.execute("create table purchase_order_item(id bigint primary key,purchase_order_id bigint,received_quantity decimal(15,3))");sql.execute("insert into purchase_order_item values(100,10,2),(200,20,3)");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("18").target("19").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("update purchase_orders set supplier_id=2 where id=10");
   try(var rows=sql.executeQuery("select supplier_id,received_quantity from purchase_order_item order by id")) {
    assertTrue(rows.next());assertEquals(1,rows.getLong(1));assertEquals(2,rows.getInt(2));assertTrue(rows.next());assertEquals(2,rows.getLong(1));assertEquals(3,rows.getInt(2));
   }
   assertThrows(java.sql.SQLException.class,()->sql.execute("update purchase_order_item set supplier_id=999 where id=100"));
  }
 }
}
