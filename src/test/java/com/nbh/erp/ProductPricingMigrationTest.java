package com.nbh.erp;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class ProductPricingMigrationTest {
 @Test void restoresLatestProcessedPricesAndPreservesLegacyProducts() throws Exception {
  String url="jdbc:h2:mem:product-pricing-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table products(id bigint primary key,selling_price decimal(38,2))");
   sql.execute("create table grns(id bigint primary key,status varchar(30),created_at timestamp,updated_at timestamp)");
   sql.execute("create table grn_items(id bigint primary key,product_id bigint,grn_id bigint,selling_price decimal(38,2),use_brand_markup boolean)");
   sql.execute("insert into products values(1,0),(2,0),(3,0),(4,300),(5,0)");
   sql.execute("insert into grns values(1,'PROCESSED','2026-10-01','2026-10-01'),(2,'PROCESSED','2026-10-02','2026-10-02'),(3,'CANCELLED','2026-10-03','2026-10-03')");
   sql.execute("insert into grn_items values(1,2,1,111,false),(2,2,2,150,false),(3,3,2,125,true),(4,2,3,999,false),(5,5,1,null,false)");
  }
  var flyway=Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("19").target("20").load();
  assertEquals(1,flyway.migrate().migrationsExecuted);assertEquals(0,flyway.migrate().migrationsExecuted);
  try(var connection=DriverManager.getConnection(url,"sa","");var sql=connection.createStatement();var rows=sql.executeQuery("select id,selling_price,use_brand_markup from products order by id")) {
   assertTrue(rows.next());assertNull(rows.getObject(3));assertEquals(0,rows.getBigDecimal(2).signum());
   assertTrue(rows.next());assertEquals(150,rows.getInt(2));assertEquals(false,rows.getBoolean(3));
   assertTrue(rows.next());assertEquals(125,rows.getInt(2));assertTrue(rows.getBoolean(3));
   assertTrue(rows.next());assertEquals(300,rows.getInt(2));assertNull(rows.getObject(3));
   assertTrue(rows.next());assertNull(rows.getObject(3));
  }
 }
}
