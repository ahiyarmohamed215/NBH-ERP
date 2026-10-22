package com.nbh.erp;
import org.junit.jupiter.api.Test;
import org.flywaydb.core.Flyway;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
class HeldWarehouseMigrationTest {
 @Test void originalCopiesUpgradeKeepsExistingBillsAndDoesNotInventReviewedOriginals() throws Exception {
  String url="jdbc:h2:mem:held-original-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   s.execute("create table invoices(id bigint primary key,status varchar(30),net_total decimal(19,2))");
   s.execute("insert into invoices values(1,'STOCK_ADJUSTED',20),(2,'SENT_TO_WAREHOUSE',50)");
  }
  var flyway=Flyway.configure().dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("40").target("41").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement();var r=s.executeQuery("select status,net_total,original_held_snapshot,cancellation_reason from invoices where id=1")){
   assertTrue(r.next());assertEquals("STOCK_ADJUSTED",r.getString(1));assertEquals(0,new java.math.BigDecimal("20").compareTo(r.getBigDecimal(2)));assertNull(r.getString(3));assertNull(r.getString(4));
  }
 }
 @Test void officePrinterUpgradePreservesSharedPrinterAndCorrectsOnlyUnprintedBillStatuses() throws Exception {
  String url="jdbc:h2:mem:office-printer-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   s.execute("create table warehouse_printers(warehouse_id bigint primary key,printer_name varchar(255))");
   s.execute("create table invoices(id bigint primary key,status varchar(30))");
   s.execute("create table held_print_jobs(id bigint primary key,bill_id bigint,warehouse_id bigint,status varchar(30))");
   s.execute("insert into warehouse_printers values(1,'Office Wi-Fi A4'),(2,'Office Wi-Fi A4')");
   s.execute("insert into invoices values(1,'SENT_TO_WAREHOUSE'),(2,'SENT_TO_WAREHOUSE'),(3,'STOCK_ADJUSTED'),(4,'MERGED'),(5,'SENT_TO_WAREHOUSE'),(6,'SENT_TO_WAREHOUSE')");
   s.execute("insert into held_print_jobs values(1,1,1,'FAILED'),(2,2,1,'FAILED'),(3,2,1,'SUBMITTED'),(4,3,1,'FAILED'),(5,4,1,'FAILED'),(6,5,1,'SUBMITTED'),(7,5,2,'QUEUED')");
  }
  var flyway=Flyway.configure().dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("36").target("37").load();assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   try(var r=s.executeQuery("select printer_name from office_printer where id=1")){assertTrue(r.next());assertEquals("Office Wi-Fi A4",r.getString(1));}
   try(var r=s.executeQuery("select status from invoices order by id")){for(var status:java.util.List.of("YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED","MERGED","YET_TO_PRINT","SENT_TO_WAREHOUSE")){assertTrue(r.next());assertEquals(status,r.getString(1));}}
  }
 }
 @Test void existingLineWarehousesAreBackfilledAndPrinterQueueSurvivesRestart() throws Exception {
  String url="jdbc:h2:mem:held-review-migration;MODE=MySQL;NON_KEYWORDS=YEAR;DB_CLOSE_DELAY=-1";
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   s.execute("create table warehouses(id bigint primary key)");
   s.execute("create table invoices(id bigint primary key,warehouse_id bigint)");
   s.execute("create table invoice_items(id bigint primary key,invoice_id bigint,quantity decimal(38,2))");
   s.execute("create table stock_adjustments(id bigint primary key,reason varchar(255))");
   s.execute("insert into warehouses values(9991)");
   s.execute("insert into invoices values(9991,9991)");
   s.execute("insert into invoice_items values(9991,9991,10)");
   s.execute("insert into stock_adjustments values(9991,'Historical adjustment')");
  }
  var flyway=Flyway.configure().dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("34").target("35").load();assertEquals(1,flyway.migrate().migrationsExecuted);
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   try(var r=s.executeQuery("select warehouse_id from invoice_items where id=9991")){assertTrue(r.next());assertEquals(9991,r.getLong(1));}
   s.execute("insert into held_print_jobs(bill_id,warehouse_id,status,content,created_at) values(9991,9991,'QUEUED','Warehouse sheet',current_timestamp)");
   assertEquals(0,flyway.migrate().migrationsExecuted);
   try(var r=s.executeQuery("select status from held_print_jobs")){assertTrue(r.next());assertEquals("QUEUED",r.getString(1));}
  }
 }
}
