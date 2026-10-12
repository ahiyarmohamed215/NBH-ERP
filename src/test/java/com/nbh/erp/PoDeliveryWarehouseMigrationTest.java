package com.nbh.erp;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PoDeliveryWarehouseMigrationTest {
 @Test void upgradeSnapshotsLegacyOrderDeliveryWarehouses() throws Exception {
  String url="jdbc:h2:mem:po-delivery-warehouses;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table warehouses (id bigint primary key)");sql.execute("insert into warehouses values (1),(2)");
   sql.execute("create table purchase_orders (id bigint primary key,warehouse_id bigint)");sql.execute("insert into purchase_orders values (10,1),(20,2)");
   sql.execute("create table purchase_order_item (id bigint primary key,purchase_order_id bigint,quantity decimal(15,3))");sql.execute("insert into purchase_order_item values (100,10,5),(101,10,2),(200,20,3)");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("14").target("15").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("update purchase_orders set warehouse_id=2 where id=10");
   try(var rows=sql.executeQuery("select warehouse_id,quantity from purchase_order_item order by id")) {
    for(var pair:new int[][]{{1,5},{1,2},{2,3}}){assertTrue(rows.next());assertEquals(pair[0],rows.getInt(1));assertEquals(pair[1],rows.getInt(2));}
    assertFalse(rows.next());
   }
   assertThrows(java.sql.SQLException.class,()->sql.execute("update purchase_order_item set warehouse_id=999 where id=100"));
  }
 }
}
