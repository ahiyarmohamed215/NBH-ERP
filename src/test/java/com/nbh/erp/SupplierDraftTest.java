package com.nbh.erp;
import com.nbh.erp.supplier.dto.CreateSupplierRequest;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.supplier.service.SupplierService;
import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import jakarta.validation.Validation;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SupplierDraftTest {
 @Test void partialDraftRequiresInputAndActivationRequiresNameAndReason() {
  var repository=mock(SupplierRepository.class);var audit=mock(AuditLogService.class);
  try(var factory=Validation.buildDefaultValidatorFactory();var security=mockStatic(SecurityUtils.class)) {
   var service=new SupplierService(factory.getValidator(),repository,mock(GrnRepository.class),mock(ProductRepository.class),audit);
   when(repository.save(any(Supplier.class))).thenAnswer(i->{Supplier s=i.getArgument(0);s.setId(1L);return s;});
   var input=new CreateSupplierRequest();input.setStatus("DRAFT");
   assertThrows(BusinessException.class,()->service.createSupplier(input));
   input.setContactPerson("Nimal");var created=service.createSupplier(input);assertEquals("DRAFT",created.getStatus());assertFalse(created.getIsActive());assertNull(created.getName());
   var supplier=Supplier.builder().id(1L).supplierCode(created.getSupplierCode()).contactPerson("Nimal").status("DRAFT").isActive(false).build();
   when(repository.findByIdForUpdate(1L)).thenReturn(java.util.Optional.of(supplier));
   assertThrows(BusinessException.class,()->service.changeStatus(1L,"ACTIVE",""));
   assertThrows(BusinessException.class,()->service.changeStatus(1L,"ACTIVE","Details verified"));assertEquals("DRAFT",supplier.getStatus());
   input.setName("New supplier");service.updateSupplier(1L,input);assertEquals("DRAFT",supplier.getStatus());
   assertEquals("ACTIVE",service.changeStatus(1L,"ACTIVE","Details verified").getStatus());assertTrue(supplier.getIsActive());
   assertEquals("INACTIVE",service.changeStatus(1L,"INACTIVE","Account suspended").getStatus());assertFalse(supplier.getIsActive());
   assertEquals("DRAFT",service.changeStatus(1L,"DRAFT","Details under review").getStatus());
   input.setStatus("ACTIVE");assertThrows(BusinessException.class,()->service.updateSupplier(1L,input));
   verify(audit).log("SUPPLIER_STATUS","PURCHASING","Supplier",supplier.getSupplierCode(),"DRAFT -> ACTIVE: Details verified");
  }
 }
 @Test void migrationPreservesExistingStatusesAndAllowsPartialDraft() throws Exception {
  String url="jdbc:h2:mem:supplier-draft-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
  try(var connection=java.sql.DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("create table suppliers(id bigint primary key,name varchar(150) not null,is_active boolean)");sql.execute("insert into suppliers values(1,'Active',true),(2,'Inactive',false)");
  }
  var flyway=org.flywaydb.core.Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("22").target("23").load();assertEquals(1,flyway.migrate().migrationsExecuted);
  try(var connection=java.sql.DriverManager.getConnection(url,"sa","");var sql=connection.createStatement()) {
   sql.execute("insert into suppliers values(3,null,false,'DRAFT')");try(var rows=sql.executeQuery("select supplier_status from suppliers order by id")){for(String expected:java.util.List.of("ACTIVE","INACTIVE","DRAFT")){assertTrue(rows.next());assertEquals(expected,rows.getString(1));}}
  }
 }
}
