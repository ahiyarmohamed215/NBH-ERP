package com.nbh.erp;

import com.nbh.erp.sales.service.InvoiceService;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.exception.BusinessException;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class HeldBillWorkflowIntegrationTest {
 @Autowired InvoiceService invoices;
 @Autowired InvoiceRepository records;
 @Autowired StockService stock;
 @Autowired CustomerRepository customers;
 @Autowired WarehouseRepository warehouses;
 @Autowired ProductRepository products;
 @Autowired CategoryRepository categories;
 @MockitoBean Clock businessClock;
 record Fixture(Long customer,Long warehouse,Long product) {}
 @BeforeEach void setup(){when(businessClock.getZone()).thenReturn(ZoneId.of("Asia/Colombo"));when(businessClock.instant()).thenReturn(Instant.parse("2026-10-31T12:00:00Z"));principal("held-admin",true);}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 void principal(String name,boolean admin){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(name,null,List.of(new SimpleGrantedAuthority(admin?"ROLE_ADMIN":"SALES_CREATE"))));}
 Fixture fixture(){
  String key=UUID.randomUUID().toString().substring(0,8);
  var customer=customers.save(com.nbh.erp.customer.entity.Customer.builder().customerCode(key).name("Held customer").creditLimit(BigDecimal.valueOf(10000)).currentBalance(BigDecimal.ZERO).isActive(true).build());
  var warehouse=warehouses.save(com.nbh.erp.warehouse.entity.Warehouse.builder().code(key).name("Held warehouse").isActive(true).build());
  var category=categories.save(com.nbh.erp.category.entity.Category.builder().code(key).name("Held category").build());
  var product=products.save(com.nbh.erp.product.entity.Product.builder().sku(key).name("Held product").category(category).defaultWarehouse(warehouse).sellingPrice(BigDecimal.TEN).costPrice(BigDecimal.ONE).isActive(true).build());
  stock.increaseStock(warehouse.getId(),product.getId(),BigDecimal.TEN,BigDecimal.ONE,"GRN",key,"Held test stock");
  return new Fixture(customer.getId(),warehouse.getId(),product.getId());
 }
 CreateInvoiceRequest held(Fixture f,int qty){return CreateInvoiceRequest.builder().customerId(f.customer).warehouseId(f.warehouse).invoiceDate(LocalDate.now(businessClock)).hold(true).reserveStock(true).items(List.of(CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(f.product).quantity(BigDecimal.valueOf(qty)).unitPrice(BigDecimal.TEN).build())).build();}
 @Test void heldNumbersDoNotConsumeInvoiceNumbersAndMergeCreatesOneInvoice(){
  var f=fixture();var a=invoices.createInvoice(held(f,2));var b=invoices.createInvoice(held(f,3));
  assertNull(a.getInvoiceNumber());assertNull(b.getInvoiceNumber());assertTrue(a.getHeldNumber().startsWith("HLD-"));assertNotEquals(a.getHeldNumber(),b.getHeldNumber());
  long before=records.countByStatusIn(Set.of("COMPLETED","PAID","PARTIAL"));
  var preview=invoices.previewHeldMerge(List.of(a.getId(),b.getId()));assertEquals(0,BigDecimal.valueOf(50).compareTo(preview.totalAmount()));
  var result=invoices.completeHeldInvoices(List.of(a.getId(),b.getId()));assertEquals(1,result.size());var invoice=result.getFirst();
  assertTrue(invoice.getInvoiceNumber().startsWith("INV-"));assertNull(invoice.getHeldNumber());assertEquals(before+1,records.countByStatusIn(Set.of("COMPLETED","PAID","PARTIAL")));
  assertEquals(0,BigDecimal.valueOf(50).compareTo(invoice.getNetTotal()));assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  var source=records.findById(a.getId()).orElseThrow();assertEquals("MERGED",source.getStatus());assertEquals(invoice.getId(),source.getMergedInvoiceId());assertNull(source.getInvoiceNumber());
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(a.getId(),b.getId())));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  invoices.voidInvoice(invoice.getId(),"Merged order cancelled");
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,customers.findById(f.customer).orElseThrow().getCurrentBalance().signum());
 }
 @Test void failedCreditCheckRollsBackSourceBillsAndTheirStock(){
  var f=fixture();var customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.ZERO);customers.saveAndFlush(customer);
  var bill=invoices.createInvoice(held(f,2));long count=records.count();
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(bill.getId())));
  assertEquals(count,records.count());assertEquals("HELD",records.findById(bill.getId()).orElseThrow().getStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void staleMergePreviewDoesNotInvoiceChangedHeldBills(){
  var f=fixture();var bill=invoices.createInvoice(held(f,2));var preview=invoices.previewHeldMerge(List.of(bill.getId()));
  var change=held(f,3);change.setExpectedVersion(bill.getRecordVersion());invoices.savePosDraft(bill.getId(),change);
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(preview.sourceBillIds(),preview.expectedVersions()));
  assertEquals("HELD",records.findById(bill.getId()).orElseThrow().getStatus());
 }
 @Test void invalidMergeLeavesBothHeldBillsAndReservationsIntact(){
  var f=fixture();var other=fixture();var a=invoices.createInvoice(held(f,2));var b=invoices.createInvoice(held(other,3));
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(a.getId(),b.getId())));
  assertEquals("HELD",records.findById(a.getId()).orElseThrow().getStatus());assertEquals("HELD",records.findById(b.getId()).orElseThrow().getStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void workspaceSeparatesStaffAndResetsAmountsAtTheNextCalendarMonth(){
  var f=fixture();String owner="held-"+UUID.randomUUID();principal(owner,false);var own=invoices.createInvoice(held(f,2));
  principal("other-"+owner,false);invoices.createInvoice(held(f,3));principal(owner,false);
  var mine=invoices.heldWorkspace("mine","",null);assertTrue(mine.bills().stream().anyMatch(b->b.getId().equals(own.getId())));assertEquals(0,BigDecimal.valueOf(20).compareTo(mine.mineAmount()));assertEquals(LocalDate.of(2026,10,31),mine.periodEnd());
  var others=invoices.heldWorkspace("others","",null);assertTrue(others.bills().stream().noneMatch(b->b.getId().equals(own.getId())));assertTrue(others.bills().stream().allMatch(b->!b.getCanResume()));
  assertEquals(0,invoices.heldWorkspace("mine","",own.getId()).mineAmount().signum());
  when(businessClock.instant()).thenReturn(Instant.parse("2026-10-31T18:30:00Z"));
  var next=invoices.heldWorkspace("mine","",null);assertEquals(LocalDate.of(2026,11,1),next.periodStart());assertEquals(LocalDate.of(2026,11,30),next.periodEnd());assertEquals(0,next.mineAmount().signum());assertEquals(0,next.mineCount());
  assertTrue(next.bills().stream().anyMatch(b->b.getId().equals(own.getId())),"Month reset must not delete open held bills");
  when(businessClock.instant()).thenReturn(Instant.parse("2028-02-15T00:00:00Z"));assertEquals(LocalDate.of(2028,2,29),invoices.heldWorkspace("mine","",null).periodEnd());
 }
}
