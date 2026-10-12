package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PoWorkflowMigrationTest {
 @Test void upgradeRetainsReceiptsAndMapsLegacyStatusesToDraftOrOrdered() throws Exception {
  String url="jdbc:h2:mem:po-workflow;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table purchase_orders(id bigint primary key,status varchar(30))");
   sql.execute("create table purchase_order_item(id bigint primary key,purchase_order_id bigint,received_quantity decimal(15,3))");
   sql.execute("insert into purchase_orders values(1,'PENDING'),(2,'APPROVED'),(3,'PARTIAL'),(4,'RECEIVED'),(5,'CANCELLED'),(6,'CANCELLED'),(7,'DRAFT'),(8,'ORDERED')");
   sql.execute("insert into purchase_order_item values(30,3,2),(40,4,5),(60,6,1)");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("16").target("17").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   try(var rows=sql.executeQuery("select status from purchase_orders order by id")) {
    for(var status:new String[]{"DRAFT","ORDERED","ORDERED","ORDERED","DRAFT","ORDERED","DRAFT","ORDERED"}) {assertTrue(rows.next());assertEquals(status,rows.getString(1));}
    assertFalse(rows.next());
   }
   try(var rows=sql.executeQuery("select sum(received_quantity) from purchase_order_item")) {assertTrue(rows.next());assertEquals(8,rows.getInt(1));}
  }
 }
 @Test void informToOrderRenamePreservesDraftCancellationAndReceiptQuantities() throws Exception {
  String url="jdbc:h2:mem:po-inform-workflow;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table purchase_orders(id bigint primary key,status varchar(30))");
   sql.execute("insert into purchase_orders values(1,'DRAFT'),(2,'ORDERED'),(3,'CANCELLED'),(4,'INFORM_TO_ORDER')");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("17").target("18").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select status from purchase_orders order by id")) {
   for(var status:new String[]{"DRAFT","INFORM_TO_ORDER","CANCELLED","INFORM_TO_ORDER"}) {assertTrue(rows.next());assertEquals(status,rows.getString(1));}
   assertFalse(rows.next());
  }
 }
}
