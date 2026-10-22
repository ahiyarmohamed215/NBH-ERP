package com.nbh.erp;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import com.nbh.erp.sales.service.*;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest @Transactional
class PosStaffPerformanceIntegrationTest {
 @Autowired PosStaffPerformanceService performance;@Autowired InvoiceService invoices;@Autowired HeldWarehouseWorkflow workflow;@Autowired com.nbh.erp.sales.repository.InvoiceRepository records;
 @Autowired com.nbh.erp.customer.repository.CustomerRepository customers;@Autowired com.nbh.erp.warehouse.repository.WarehouseRepository warehouses;@Autowired com.nbh.erp.category.repository.CategoryRepository categories;@Autowired com.nbh.erp.product.repository.ProductRepository products;@Autowired com.nbh.erp.inventory.service.StockService stock;@Autowired Clock clock;
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void originalSentBillQualifiesWithoutDoubleCountingItsMergedInvoice(){
  String key=UUID.randomUUID().toString().substring(0,8),author="pos-performance-"+key;
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(author,null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
  var c=customers.save(com.nbh.erp.customer.entity.Customer.builder().customerCode(key).name("POS performance").creditLimit(BigDecimal.valueOf(10000)).currentBalance(BigDecimal.ZERO).isActive(true).build());
  var w=warehouses.save(com.nbh.erp.warehouse.entity.Warehouse.builder().code(key).name("POS stock").isActive(true).build());
  var cat=categories.save(com.nbh.erp.category.entity.Category.builder().code(key).name("POS category").build());
  var p=products.save(com.nbh.erp.product.entity.Product.builder().sku(key).name("POS product").category(cat).defaultWarehouse(w).sellingPrice(BigDecimal.TEN).costPrice(BigDecimal.ONE).isActive(true).build());
  stock.increaseStock(w.getId(),p.getId(),BigDecimal.TEN,BigDecimal.ONE,"GRN",key,"Performance fixture");
  var req=CreateInvoiceRequest.builder().customerId(c.getId()).warehouseId(w.getId()).invoiceDate(LocalDate.now(clock)).hold(true).reserveStock(true).items(List.of(CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(p.getId()).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build())).build();
  var draft=invoices.createInvoice(req);var pending=workflow.send(draft.getId(),new HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),null,false));
  var row=performance.performance(null).staff().stream().filter(s->s.username().equals(author)).findFirst().orElseThrow();assertEquals(1,row.pendingPrintCount());assertEquals(0,row.confirmedAmount().signum());
  workflow.reprint(pending.getId(),null);var sent=invoices.getInvoiceById(pending.getId());
  var reviewed=workflow.review(sent.getId(),new HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"One approved by warehouse",sent.getItems().stream().map(i->new HeldWarehouseWorkflow.ReviewLine(i.getId(),BigDecimal.ONE,null)).toList()));
  var merged=invoices.completeHeldInvoices(List.of(reviewed.getId())).getFirst();
  row=performance.performance(null).staff().stream().filter(s->s.username().equals(author)).findFirst().orElseThrow();assertEquals(1,row.billCount());assertEquals(0,BigDecimal.valueOf(20).compareTo(row.originalAmount()));assertEquals(0,BigDecimal.valueOf(20).compareTo(row.confirmedAmount()));
  var docs=records.findPerformanceDocuments(LocalDate.now(clock).withDayOfMonth(1),LocalDate.now(clock).withDayOfMonth(LocalDate.now(clock).lengthOfMonth()));assertTrue(docs.stream().anyMatch(i->i.getId().equals(sent.getId())));assertFalse(docs.stream().anyMatch(i->i.getId().equals(merged.getId())));
  invoices.cancelHeldInvoice(sent.getId(),"Cancel original POS order",records.findById(sent.getId()).orElseThrow().getRecordVersion());
  assertTrue(performance.performance(null).staff().stream().filter(s->s.username().equals(author)).allMatch(s->s.billCount()==0));
 }
}
