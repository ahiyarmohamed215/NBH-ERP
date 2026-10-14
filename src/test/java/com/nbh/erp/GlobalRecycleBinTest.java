package com.nbh.erp;
import com.nbh.erp.recyclebin.RecycleBinService;
import com.nbh.erp.common.entity.RecyclableEntity;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.product.entity.Product;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;

@SpringBootTest @Transactional
class GlobalRecycleBinTest {
 @Autowired RecycleBinService bin; @Autowired EntityManager em;
 @Autowired com.nbh.erp.brand.repository.BrandRepository brands;
 @Autowired com.nbh.erp.category.repository.CategoryRepository categories;
 @Autowired com.nbh.erp.warehouse.repository.WarehouseRepository warehouses;
 @Autowired com.nbh.erp.customer.repository.CustomerRepository customers;
 @Autowired com.nbh.erp.user.repository.UserRepository users;
 @Autowired com.nbh.erp.inventory.repository.ProductStaffQuotaRepository allocations;
 void auth(String... permissions){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("bin-test-manager","test",Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));}
 @BeforeEach void setup(){auth("ROLE_ADMIN");} @AfterEach void clear(){SecurityContextHolder.clearContext();}
 Map<String,RecyclableEntity> records(){
  Map<String,RecyclableEntity> records=new LinkedHashMap<>();
  records.put("BRAND",Brand.builder().code("BIN-BR").name("Test brand").build());
  records.put("CATEGORY",Category.builder().code("BIN-CAT").name("Test category").build());
  records.put("WAREHOUSE",Warehouse.builder().code("BIN-WH").name("Test warehouse").build());
  records.put("CUSTOMER",Customer.builder().customerCode("BIN-CU").name("Test customer").build());
  records.put("USER",User.builder().username("bin-staff").email("bin@example.test").password("unused-test").fullName("Test employee").approvalStatus("APPROVED").isActive(true).build());
  records.put("ALLOCATION",ProductStaffQuota.builder().allocationStatus("DRAFT").isActive(false).notes("Draft allocation").build());
  records.values().forEach(em::persist);em.flush();return records;
 }
 @Test void everyRecordTypeCanBeDeletedRestoredAndPermanentlyRemoved(){
  var records=records();
  records.forEach((type,record)->bin.delete(type,record.getId()));em.flush();
  for(var pair:records.entrySet()){assertTrue(pair.getValue().isDeleted());assertFalse(pair.getValue().getIsActive());assertTrue(bin.list().stream().anyMatch(entry->entry.type().equals(pair.getKey()) && entry.id().equals(pair.getValue().getId())));}
  assertFalse(brands.findAll().stream().anyMatch(r->r.getId().equals(records.get("BRAND").getId())));
  assertFalse(categories.findAll().stream().anyMatch(r->r.getId().equals(records.get("CATEGORY").getId())));
  assertFalse(warehouses.findAll().stream().anyMatch(r->r.getId().equals(records.get("WAREHOUSE").getId())));
  assertFalse(customers.findAll().stream().anyMatch(r->r.getId().equals(records.get("CUSTOMER").getId())));
  assertFalse(users.findAll(org.springframework.data.domain.PageRequest.of(0,100)).stream().anyMatch(r->r.getId().equals(records.get("USER").getId())));
  assertFalse(allocations.searchQuotas(null,null,null,null,null,org.springframework.data.domain.PageRequest.of(0,100)).stream().anyMatch(r->r.getId().equals(records.get("ALLOCATION").getId())));
  records.forEach((type,record)->bin.restore(type,record.getId()));em.flush();
  records.forEach((type,record)->{assertNull(record.getDeletedAt());assertEquals(!type.equals("ALLOCATION"),record.getIsActive());});
  assertEquals("DRAFT",((ProductStaffQuota)records.get("ALLOCATION")).getAllocationStatus());
  records.forEach((type,record)->{bin.delete(type,record.getId());bin.purge(type,record.getId());assertThrows(BusinessException.class,()->bin.restore(type,record.getId()));});em.flush();
  assertTrue(bin.list().stream().noneMatch(entry->records.containsKey(entry.type()) && records.get(entry.type()).getId().equals(entry.id())));
  records.values().forEach(record->assertNotNull(em.find(record.getClass(),record.getId()),"Historical identities remain valid"));
 }
 @Test void permissionsLimitBinVisibilityAndActions(){
  var records=records();records.forEach((type,record)->bin.delete(type,record.getId()));em.flush();auth("BRAND_MANAGE");
  assertTrue(bin.list().stream().allMatch(entry->entry.type().equals("BRAND")));
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->bin.restore("USER",records.get("USER").getId()));
  auth("BRAND_VIEW");assertTrue(bin.list().isEmpty());assertThrows(org.springframework.security.access.AccessDeniedException.class,()->bin.purge("BRAND",records.get("BRAND").getId()));
 }
 @Test void linkedProductAndEmployeeSessionsRemainConsistent(){
  var records=records();var category=(Category)records.get("CATEGORY");var brand=(Brand)records.get("BRAND");var warehouse=(Warehouse)records.get("WAREHOUSE");var user=(User)records.get("USER");
  Product product=Product.builder().sku("BIN-PRODUCT").name("Linked product").category(category).brand(brand).defaultWarehouse(warehouse).build();em.persist(product);em.flush();
  long version=user.getTokenVersion();bin.delete("USER",user.getId());assertEquals(version+1,user.getTokenVersion());bin.restore("USER",user.getId());assertEquals(version+2,user.getTokenVersion());
  bin.delete("BRAND",brand.getId());bin.purge("BRAND",brand.getId());bin.delete("CATEGORY",category.getId());bin.purge("CATEGORY",category.getId());bin.delete("WAREHOUSE",warehouse.getId());bin.purge("WAREHOUSE",warehouse.getId());em.flush();em.clear();
  var retained=em.find(Product.class,product.getId());assertEquals("Test brand",retained.getBrand().getName());assertEquals("Test category",retained.getCategory().getName());assertEquals("Test warehouse",retained.getDefaultWarehouse().getName());
 }
 @Test void migrationPreservesExistingRows() throws Exception {
  String url="jdbc:h2:mem:global-bin-migration;MODE=MySQL;NON_KEYWORDS=YEAR;DB_CLOSE_DELAY=-1";
  try(var connection=java.sql.DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()){for(String table:List.of("brands","categories","warehouses","customers","users","product_staff_quotas")){sql.execute("create table "+table+"(id bigint primary key,is_active boolean)");sql.execute("insert into "+table+" values(1,true)");}}
  var flyway=org.flywaydb.core.Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("24").target("25").load();assertEquals(1,flyway.migrate().migrationsExecuted);
  try(var connection=java.sql.DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()){for(String table:List.of("brands","categories","warehouses","customers","users","product_staff_quotas")){try(var row=sql.executeQuery("select * from "+table)){assertTrue(row.next());assertTrue(row.getBoolean("is_active"));assertNull(row.getTimestamp("deleted_at"));}}}
 }
 @Test void restoringAnActiveAllocationRequiresStockAndPreservesSoldQuantity(){
  var records=records();var warehouse=(Warehouse)records.get("WAREHOUSE");var employee=(User)records.get("USER");
  Product product=Product.builder().sku("BIN-STOCK").name("Allocated product").category((Category)records.get("CATEGORY")).defaultWarehouse(warehouse).build();em.persist(product);
  var balance=com.nbh.erp.inventory.entity.StockBalance.builder().product(product).warehouse(warehouse).quantity(java.math.BigDecimal.ZERO).build();em.persist(balance);
  var allocation=(ProductStaffQuota)records.get("ALLOCATION");allocation.setProduct(product);allocation.setUser(employee);allocation.setWarehouse(null);allocation.setAllocatedQuantity(new java.math.BigDecimal("5"));allocation.setSoldQuantity(new java.math.BigDecimal("2"));allocation.setAllocationStatus("ACTIVE");allocation.setIsActive(true);em.flush();
  bin.delete("ALLOCATION",allocation.getId());em.flush();assertThrows(BusinessException.class,()->bin.restore("ALLOCATION",allocation.getId()));assertTrue(allocation.isDeleted());
  balance.setQuantity(new java.math.BigDecimal("3"));em.flush();bin.restore("ALLOCATION",allocation.getId());assertTrue(allocation.getIsActive());assertEquals("ACTIVE",allocation.getAllocationStatus());assertEquals(new java.math.BigDecimal("2"),allocation.getSoldQuantity());
 }
 @Test void employeeSelfDeletionIsBlocked(){
  var records=records();var employee=(User)records.get("USER");var principal=com.nbh.erp.security.UserPrincipal.create(employee);
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,List.of(new SimpleGrantedAuthority("USER_MANAGE"))));
  assertThrows(BusinessException.class,()->bin.delete("USER",employee.getId()));assertFalse(employee.isDeleted());assertTrue(employee.getIsActive());
 }
}
