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
import org.springframework.transaction.annotation.Transactional;
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
 @org.springframework.test.context.bean.override.mockito.MockitoBean com.nbh.erp.customer.service.PosCustomerAccess posCustomerAccess;
 @Autowired InvoiceService invoices;
 @Autowired com.nbh.erp.sales.service.HeldWarehouseWorkflow workflow;

 @Autowired com.nbh.erp.stockadjustment.repository.StockAdjustmentRepository adjustmentRecords;
 @Autowired com.nbh.erp.user.repository.UserRepository users;
 @Autowired com.nbh.erp.salesreturn.service.SalesReturnService returns;
 @Autowired com.nbh.erp.sales.service.HeldPrintProgress progress;
 @Autowired com.nbh.erp.sales.service.HeldOriginalsService originals;
 @Autowired com.nbh.erp.customerrange.repository.CustomerMonthlySummaryRepository monthlySummaries;

 @Autowired org.springframework.transaction.support.TransactionTemplate transactions;
 com.nbh.erp.sales.dto.InvoiceDto printed(com.nbh.erp.sales.dto.InvoiceDto bill){
  workflow.reprint(bill.getId(), null); return invoices.getInvoiceById(bill.getId());
 }
 com.nbh.erp.sales.dto.InvoiceDto ready(com.nbh.erp.sales.dto.InvoiceDto bill){
  String owner="held-admin";if(users.findByUsername(owner).isEmpty())users.save(com.nbh.erp.user.entity.User.builder().username(owner).password("test").email("held-admin@test.example").fullName(owner).build());
  var sent=printed(workflow.send(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(),owner)));
  return workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Signed warehouse sheets checked",sent.getItems().stream().map(i->new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(i.getId(),i.getQuantity(),null)).toList()));
 }
 @Autowired InvoiceRepository records;
 @Autowired StockService stock;
 @Autowired com.nbh.erp.inventory.repository.ProductStaffQuotaRepository allocationRecords;
 @Autowired com.nbh.erp.sales.service.PosAllocationService posAllocations;
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
 @Test @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
 void submittedAndCancelledBillsRefreshRangeSummaryAfterCommit(){
  String owner="print-events-"+UUID.randomUUID().toString().substring(0,8);principal(owner,true);
  users.save(com.nbh.erp.user.entity.User.builder().username(owner).password("test").email(owner+"@test.example").fullName(owner).build());
  var f=fixture();var draft=invoices.createInvoice(held(f,2));
  var saved=workflow.send(draft.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),owner,false));
  var sent=printed(saved);
  var month=java.time.YearMonth.from(sent.getInvoiceDate()).toString();
  assertEquals(0,BigDecimal.valueOf(20).compareTo(monthlySummaries.findByCustomerIdAndYearMonth(f.customer,month).orElseThrow().getQualifyingPurchases()));
  invoices.cancelHeldInvoice(sent.getId(),"Customer cancelled after warehouse dispatch",sent.getRecordVersion());
  assertEquals(0,monthlySummaries.findByCustomerIdAndYearMonth(f.customer,month).orElseThrow().getQualifyingPurchases().signum());
 }
 @Autowired com.nbh.erp.payment.service.PaymentService customerPayments;
 @Test void zeroCreditLimitAllowsBillingAndMergeWithExistingOutstanding(){
  var f=fixture();var customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.ZERO);customers.saveAndFlush(customer);
  var posted=held(f,2);posted.setHold(false);posted.setPaymentType("CREDIT");posted.setPaidAmount(BigDecimal.ZERO);invoices.createInvoice(posted);
  var adjusted=ready(invoices.createInvoice(held(f,3)));var merged=invoices.completeHeldInvoices(List.of(adjusted.getId())).getFirst();
  assertEquals(0,BigDecimal.valueOf(30).compareTo(merged.getNetTotal()));
  assertEquals(0,BigDecimal.valueOf(50).compareTo(customers.findById(f.customer).orElseThrow().getCurrentBalance()));
 }
 @Test void creditLimitAllowsOnholdButBlocksFinalInvoiceUntilPaymentSettles(){
  var f=fixture();var customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.valueOf(50));customers.saveAndFlush(customer);
  stock.increaseStock(f.warehouse,f.product,BigDecimal.valueOf(100),BigDecimal.ONE,"GRN","CREDIT-OPEN","Credit policy test");
  var firstRequest=held(f,5);firstRequest.setHold(false);firstRequest.setPaymentType("CREDIT");firstRequest.setPaidAmount(BigDecimal.ZERO);
  var first=invoices.createInvoice(firstRequest);
  var direct=held(f,1);direct.setHold(false);direct.setPaymentType("CREDIT");direct.setPaidAmount(BigDecimal.ZERO);
  assertTrue(assertThrows(BusinessException.class,()->invoices.createInvoice(direct)).getMessage().contains("limit reached"));
  var draft=invoices.createInvoice(held(f,1));
  var edited=invoices.savePosDraft(draft.getId(),held(f,2));
  assertEquals(0,BigDecimal.valueOf(20).compareTo(edited.getNetTotal()));
  var reviewed=ready(edited);
  assertEquals(0,BigDecimal.valueOf(50).compareTo(customers.findById(f.customer).orElseThrow().getCurrentBalance()));
  var before=stock.getAvailableStock(f.warehouse,f.product);
  assertThrows(BusinessException.class,()->invoices.mergeHeldBills(List.of(reviewed.getId())));
  assertEquals("STOCK_ADJUSTED",invoices.getInvoiceById(reviewed.getId()).getStatus());
  assertEquals(0,before.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  customerPayments.processPayment(com.nbh.erp.payment.dto.CreatePaymentRequest.builder().invoiceId(first.getId()).amount(BigDecimal.valueOf(10)).paymentMethod("CASH").build());
  assertThrows(BusinessException.class,()->invoices.mergeHeldBills(List.of(reviewed.getId())));
  customerPayments.processPayment(com.nbh.erp.payment.dto.CreatePaymentRequest.builder().invoiceId(first.getId()).amount(BigDecimal.valueOf(10)).paymentMethod("CASH").build());
  var merged=invoices.mergeHeldBills(List.of(reviewed.getId()));
  assertEquals(0,BigDecimal.valueOf(50).compareTo(customers.findById(f.customer).orElseThrow().getCurrentBalance()));
  assertEquals(0,BigDecimal.valueOf(50).compareTo(customers.findById(f.customer).orElseThrow().getCreditLimit()));
  assertTrue(invoices.getCustomerInvoices(f.customer,true).stream().anyMatch(i->i.getId().equals(merged.getId())));
 }
 @Test void raisingCreditLimitAllowsFinalizingAnOverLimitOnholdBill(){
  var f=fixture();var customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.TEN);customers.saveAndFlush(customer);
  var reviewed=ready(invoices.createInvoice(held(f,2)));
  assertThrows(BusinessException.class,()->invoices.mergeHeldBills(List.of(reviewed.getId())));
  customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.valueOf(20));customers.saveAndFlush(customer);
  var merged=invoices.mergeHeldBills(List.of(reviewed.getId()));
  assertEquals(0,BigDecimal.valueOf(20).compareTo(merged.getNetTotal()));
 }
 @Test void cancellingOneMergedBillRestoresOnlyItsWarehouseStockAndRecalculatesInvoice(){
  var f=fixture();var other=fixture();stock.increaseStock(other.warehouse,f.product,BigDecimal.TEN,BigDecimal.ONE,"GRN","CANCEL-OPEN","Opening stock");
  var requestA=held(f,2);requestA.setDiscountAmount(BigDecimal.valueOf(2));requestA.setTaxRate(BigDecimal.TEN);
  requestA.setItems(List.of(requestA.getItems().getFirst(),CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(f.product).warehouseId(other.warehouse).quantity(BigDecimal.ONE).unitPrice(BigDecimal.TEN).build()));
  var requestB=held(f,2);requestB.setDiscountAmount(BigDecimal.ONE);requestB.setTaxRate(BigDecimal.TEN);
  var a=ready(invoices.createInvoice(requestA));var b=ready(invoices.createInvoice(requestB));
  var merged=invoices.completeHeldInvoices(List.of(a.getId(),b.getId())).getFirst();
  var version=records.findById(a.getId()).orElseThrow().getRecordVersion();
  var original=originals.workspace("mine",a.getHeldNumber()).bills().getFirst();assertEquals(version,original.getRecordVersion());
  invoices.cancelHeldInvoice(a.getId(),"Customer removed this warehouse order",version);
  var remaining=invoices.getInvoiceById(merged.getId());
  assertEquals(0,b.getNetTotal().compareTo(remaining.getNetTotal()));assertEquals(0,b.getTaxAmount().compareTo(remaining.getTaxAmount()));assertEquals(0,b.getDiscountAmount().compareTo(remaining.getDiscountAmount()));
  assertEquals(0,b.getNetTotal().compareTo(remaining.getBalanceAmount()));assertEquals(1,remaining.getItems().size());
  assertEquals(List.of(b.getHeldNumber()),remaining.getSourceHeldNumbers());assertEquals(b.getId(),remaining.getSourceHeldBills().getFirst().id());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(other.warehouse,f.product)));
  assertEquals(0,b.getNetTotal().compareTo(customers.findById(f.customer).orElseThrow().getCurrentBalance()));
  var cancelled=originals.workspace("mine",a.getHeldNumber()).bills().getFirst();assertEquals("CANCELLED",cancelled.getStatus());assertEquals(0,a.getNetTotal().compareTo(cancelled.getNetTotal()));
  assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(a.getId(),"Repeat",version));
  invoices.cancelHeldInvoice(b.getId(),"Cancel last remaining bill",records.findById(b.getId()).orElseThrow().getRecordVersion());
  var empty=invoices.getInvoiceById(merged.getId());assertEquals("VOIDED",empty.getStatus());assertTrue(empty.getItems().isEmpty());assertTrue(empty.getSourceHeldNumbers().isEmpty());assertEquals(0,empty.getBalanceAmount().signum());
  assertEquals(0,customers.findById(f.customer).orElseThrow().getCurrentBalance().signum());assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void mergedBillCancellationRejectsPaidDeliveryReturnAndUnauthorisedStatesWithoutChangingStock(){
  var f=fixture();var source=ready(invoices.createInvoice(held(f,2)));var merged=invoices.completeHeldInvoices(List.of(source.getId())).getFirst();
  long version=records.findById(source.getId()).orElseThrow().getRecordVersion();
  principal("held-admin",false);assertThrows(org.springframework.security.access.AccessDeniedException.class,()->invoices.cancelHeldInvoice(source.getId(),"No edit permission",version));principal("held-admin",true);
  assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(source.getId(),"Old version",source.getRecordVersion()));
  var parent=records.findById(merged.getId()).orElseThrow();parent.setPaidAmount(BigDecimal.ONE);parent.setStatus("PARTIAL");parent.setBalanceAmount(BigDecimal.valueOf(19));records.saveAndFlush(parent);
  assertTrue(assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(source.getId(),"Paid invoice",version)).getMessage().contains("partially paid"));
  parent=records.findById(merged.getId()).orElseThrow();parent.setPaidAmount(BigDecimal.valueOf(20));parent.setStatus("PAID");parent.setBalanceAmount(BigDecimal.ZERO);records.saveAndFlush(parent);
  assertTrue(assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(source.getId(),"Paid invoice",version)).getMessage().contains("already paid"));
  for(String delivery:List.of("OUT_FOR_DELIVERY","IN_TRANSIT","DELIVERED")){
   parent=records.findById(merged.getId()).orElseThrow();parent.setPaidAmount(BigDecimal.ZERO);parent.setStatus("COMPLETED");parent.setBalanceAmount(BigDecimal.valueOf(20));parent.setDeliveryStatus(delivery);records.saveAndFlush(parent);
   assertTrue(assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(source.getId(),"Delivery started",version)).getMessage().contains(delivery.replace('_',' ')));
  }
  parent=records.findById(merged.getId()).orElseThrow();parent.setDeliveryStatus("PENDING");parent.setReturnedAmount(BigDecimal.ONE);records.saveAndFlush(parent);
  assertTrue(assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(source.getId(),"Return exists",version)).getMessage().contains("sales returns"));
  assertEquals("MERGED",records.findById(source.getId()).orElseThrow().getStatus());assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void simultaneousSourceCancellationsSerializeOnTheParentInvoice() throws Exception {
  var f=fixture();var a=ready(invoices.createInvoice(held(f,2)));var b=ready(invoices.createInvoice(held(f,3)));var parent=invoices.completeHeldInvoices(List.of(a.getId(),b.getId())).getFirst();
  long av=records.findById(a.getId()).orElseThrow().getRecordVersion(),bv=records.findById(b.getId()).orElseThrow().getRecordVersion();
  var start=new java.util.concurrent.CountDownLatch(1);
  try(var workers=java.util.concurrent.Executors.newFixedThreadPool(2)){
   var first=workers.submit(()->{principal("held-admin",true);try{start.await();invoices.cancelHeldInvoice(a.getId(),"First cancelled",av);return true;}finally{clear();}});
   var second=workers.submit(()->{principal("held-admin",true);try{start.await();invoices.cancelHeldInvoice(b.getId(),"Second cancelled",bv);return true;}finally{clear();}});
   start.countDown();assertTrue(first.get(30,java.util.concurrent.TimeUnit.SECONDS));assertTrue(second.get(30,java.util.concurrent.TimeUnit.SECONDS));
  }
  assertEquals("VOIDED",invoices.getInvoiceById(parent.getId()).getStatus());assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,customers.findById(f.customer).orElseThrow().getCurrentBalance().signum());
 }
 @Autowired com.nbh.erp.sales.service.PosProgressService posProgress;
 @Autowired com.nbh.erp.customertarget.repository.CustomerTargetRepository campaignRecords;
 @Test void posProgressMonthSeparatesHistoryAndCapsCampaignAtMonthEnd(){
  var f=fixture();var september=held(f,3);september.setInvoiceDate(LocalDate.of(2026,9,20));ready(invoices.createInvoice(september));
  var october=held(f,2);october.setInvoiceDate(LocalDate.of(2026,10,20));ready(invoices.createInvoice(october));
  campaignRecords.saveAndFlush(com.nbh.erp.customertarget.entity.CustomerTarget.builder().targetCode("MONTH-"+UUID.randomUUID()).name("Two month reward").customer(customers.findById(f.customer).orElseThrow()).startDate(LocalDate.of(2026,9,1)).endDate(LocalDate.of(2026,10,31)).targetAmount(BigDecimal.valueOf(40)).isActive(true).tiers(new ArrayList<>()).build());
  var previous=posProgress.progress(f.customer,null,"2026-09");
  assertEquals(LocalDate.of(2026,9,1),previous.periodStart());assertEquals(LocalDate.of(2026,9,30),previous.periodEnd());
  assertEquals(0,BigDecimal.valueOf(30).compareTo(previous.monthlyPurchases()));
  var oldTarget=previous.targets().stream().filter(t->t.name().equals("Two month reward")).findFirst().orElseThrow().milestones().getFirst();
  assertEquals(0,BigDecimal.valueOf(30).compareTo(oldTarget.completedAmount()));assertEquals(0,BigDecimal.TEN.compareTo(oldTarget.remaining()));
  var current=posProgress.progress(f.customer,null,"2026-10");assertEquals(0,BigDecimal.valueOf(20).compareTo(current.monthlyPurchases()));
  assertEquals(0,BigDecimal.valueOf(50).compareTo(current.targets().stream().filter(t->t.name().equals("Two month reward")).findFirst().orElseThrow().milestones().getFirst().completedAmount()));
  assertThrows(BusinessException.class,()->posProgress.progress(f.customer,null,"invalid"));
  assertThrows(BusinessException.class,()->posProgress.progress(f.customer,null,"2026-11"));
 }
 @Test void warehouseReviewCanIncreaseOnlyWithinOriginalStaffAllocationAndPhysicalStock(){
  var f=fixture();String name="review-limit-"+UUID.randomUUID().toString().substring(0,8);
  var staff=users.save(com.nbh.erp.user.entity.User.builder().username(name).password("test").email(name+"@test.example").fullName("Original POS creator").build());
  allocationRecords.save(com.nbh.erp.inventory.entity.ProductStaffQuota.builder().product(products.findById(f.product).orElseThrow()).warehouse(warehouses.findById(f.warehouse).orElseThrow()).user(staff).allocatedQuantity(BigDecimal.valueOf(5)).build());
  var request=held(f,2);request.setSalesmanId(staff.getId());var draft=invoices.createInvoice(request);
  var sent=printed(workflow.send(draft.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),null,false)));
  var other=held(f,1);other.setSalesmanId(staff.getId());invoices.createInvoice(other);
  var limits=workflow.reviewLimits(sent.getId());assertEquals(0,BigDecimal.valueOf(4).compareTo(limits.limits().getFirst().remainingQuantity()));assertEquals(0,BigDecimal.valueOf(9).compareTo(limits.stock().getFirst().availableForBill()));
  var line=sent.getItems().getFirst();
  assertThrows(BusinessException.class,()->workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Too many",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(line.getId(),BigDecimal.valueOf(5),null)))));
  assertEquals(0,BigDecimal.valueOf(7).compareTo(stock.getAvailableStock(f.warehouse,f.product)),"Rejected review must restore original reservations");
  long adjustmentCount=adjustmentRecords.count();
  var adjusted=workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Warehouse has four approved",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(line.getId(),BigDecimal.valueOf(4),null))));
  assertEquals(adjustmentCount,adjustmentRecords.count());
  assertEquals(0,BigDecimal.valueOf(6).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,BigDecimal.valueOf(4).compareTo(adjusted.getItems().getFirst().getQuantity()));
  assertEquals(0,BigDecimal.valueOf(2).compareTo(originals.read(records.findById(sent.getId()).orElseThrow()).getItems().getFirst().getQuantity()));
  var free=fixture();var noQuota=invoices.createInvoice(held(free,2));var freeSent=printed(workflow.send(noQuota.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(noQuota.getRecordVersion(),null,false)));
  assertThrows(BusinessException.class,()->workflow.review(freeSent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(freeSent.getRecordVersion(),"Too much physical stock",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(freeSent.getItems().getFirst().getId(),BigDecimal.valueOf(11),null)))));
 }
 @Test void warehouseInvoiceDoesNotRecheckAllocationChangedAfterPosBilling(){
  var f=fixture();String name="office-"+UUID.randomUUID().toString().substring(0,8);
  var staff=users.save(com.nbh.erp.user.entity.User.builder().username(name).password("test").email(name+"@test.example").fullName("POS creator").build());
  var allocation=allocationRecords.save(com.nbh.erp.inventory.entity.ProductStaffQuota.builder().product(products.findById(f.product).orElseThrow()).warehouse(warehouses.findById(f.warehouse).orElseThrow()).user(staff).allocatedQuantity(BigDecimal.valueOf(5)).build());
  var request=held(f,5);request.setSalesmanId(staff.getId());var adjusted=ready(invoices.createInvoice(request));
  allocation.setAllocatedQuantity(BigDecimal.valueOf(2));allocationRecords.save(allocation);
  var merged=invoices.completeHeldInvoices(List.of(adjusted.getId()),Map.of(adjusted.getId(),adjusted.getRecordVersion()),new com.nbh.erp.sales.dto.InvoicePacking(1,0,0,0)).getFirst();
  assertEquals("INVOICE_CREATED",invoices.heldWorkspace("mine",adjusted.getHeldNumber(),null).bills().getFirst().getStatus());
  assertEquals("PENDING",merged.getPaymentStatus());assertEquals("PENDING",merged.getDeliveryStatus());
  assertEquals(0,BigDecimal.valueOf(5).compareTo(allocationRecords.findById(allocation.getId()).orElseThrow().getSoldQuantity()));
  invoices.voidInvoice(merged.getId(),"Cancelled warehouse invoice");
  assertEquals(0,allocationRecords.findById(allocation.getId()).orElseThrow().getSoldQuantity().signum());
 }
 @Test void posAllocationLimitsReserveAcrossHeldBillsAndReleaseOnCancellation(){
  var f=fixture();String name="allocated-"+UUID.randomUUID().toString().substring(0,8);
  var staff=users.save(com.nbh.erp.user.entity.User.builder().username(name).password("test").email(name+"@test.example").fullName("Allocated POS staff").build());
  allocationRecords.save(com.nbh.erp.inventory.entity.ProductStaffQuota.builder().product(products.findById(f.product).orElseThrow()).warehouse(warehouses.findById(f.warehouse).orElseThrow()).user(staff).allocatedQuantity(BigDecimal.valueOf(5)).build());
  var request=held(f,3);request.setSalesmanId(staff.getId());var first=invoices.createInvoice(request);
  var exceeds=held(f,3);exceeds.setSalesmanId(staff.getId());assertThrows(BusinessException.class,()->invoices.createInvoice(exceeds));
  principal(name,true);
  var limits=posAllocations.current(null);assertEquals(0,BigDecimal.valueOf(2).compareTo(limits.stream().filter(limit->limit.productId().equals(f.product)).findFirst().orElseThrow().remainingQuantity()));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(posAllocations.current(first.getId()).getFirst().remainingQuantity()),"Editing the same bill must not double count its reserved allocation");
  invoices.cancelHeldInvoice(first.getId(),"Discard saved POS bill",first.getRecordVersion());
  assertEquals(0,BigDecimal.valueOf(5).compareTo(posAllocations.current(null).getFirst().remainingQuantity()));
  var allowed=held(f,5);allowed.setSalesmanId(staff.getId());var saved=invoices.createInvoice(allowed);
  assertEquals(0,posAllocations.current(null).getFirst().remainingQuantity().signum());
  var adjusted=ready(saved);var merged=invoices.completeHeldInvoices(List.of(adjusted.getId())).getFirst();
  assertEquals(0,posAllocations.current(null).getFirst().remainingQuantity().signum(),"Invoicing replaces the pending quantity with sold quantity once");
  invoices.voidInvoice(merged.getId(),"Cancel allocated invoice");
  assertEquals(0,BigDecimal.valueOf(5).compareTo(posAllocations.current(null).getFirst().remainingQuantity()));
 }
 @Test void mergeWithUnallocatedSalesStaffPersistsPackingCounts(){
  var f=fixture();String key="packing-"+UUID.randomUUID().toString().substring(0,8);
  var staff=users.save(com.nbh.erp.user.entity.User.builder().username(key).password("test").email(key+"@test.example").fullName("POS packing staff").build());
  var request=held(f,2);request.setSalesmanId(staff.getId());
  var bill=ready(invoices.createInvoice(request));
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(bill.getId()),null,null));
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(bill.getId()),null,new com.nbh.erp.sales.dto.InvoicePacking(-1,0,0,0)));
  var packing=new com.nbh.erp.sales.dto.InvoicePacking(2,3,1,0);
  var merged=invoices.completeHeldInvoices(List.of(bill.getId()),Map.of(bill.getId(),bill.getRecordVersion()),packing).getFirst();
  assertEquals(packing,merged.getPacking());
  assertEquals(packing,invoices.getInvoiceById(merged.getId()).getPacking());
  assertEquals("PENDING",merged.getPaymentStatus());assertEquals("PENDING",merged.getDeliveryStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void originalWarehouseCopySurvivesReviewMergeAndReprintWithoutDoubleCounting(){
  ready(invoices.createInvoice(held(fixture(),1)));
  var f=fixture();var direct=held(f,1);direct.setHold(false);direct.setPaymentType("CREDIT");direct.setPaidAmount(BigDecimal.ZERO);invoices.createInvoice(direct);
  assertEquals(0,records.getCustomerPerformanceBetween(f.customer,null,null).signum(),"Ordinary invoices do not qualify as warehouse-sent POS bills");
  assertEquals(0,records.countCustomerPerformanceBetween(f.customer,null,null));
  var draft=invoices.createInvoice(held(f,2));
  var pending=workflow.send(draft.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),"held-admin",false));
  assertEquals("BILLED",originals.workspace("mine",pending.getHeldNumber()).bills().getFirst().getStatus());
  assertEquals("YET_TO_PRINT",pending.getStatus());
  assertEquals("YET_TO_PRINT",invoices.heldWorkspace("mine",pending.getHeldNumber(),null).bills().getFirst().getStatus());
  assertEquals(false,originals.workspace("mine",pending.getHeldNumber()).bills().getFirst().getCanResume());
  assertEquals(0,records.getCustomerPerformanceBetween(f.customer,null,null).signum(),"Unprinted bills do not qualify");
  var edit=held(f,3);edit.setExpectedVersion(pending.getRecordVersion());assertThrows(BusinessException.class,()->invoices.savePosDraft(pending.getId(),edit));

  var sent=printed(pending);
  assertTrue(originals.workspace("mine",pending.getHeldNumber()).bills().stream().anyMatch(b->b.getId().equals(pending.getId())));
  var reviewed=workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Approved one after warehouse review",sent.getItems().stream().map(i->new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(i.getId(),BigDecimal.ONE,null)).toList()));
  assertEquals(0,BigDecimal.TEN.compareTo(reviewed.getNetTotal()));
  assertEquals("STOCK_ADJUSTED",invoices.heldWorkspace("mine",sent.getHeldNumber(),null).bills().getFirst().getStatus());
  assertEquals(0,BigDecimal.valueOf(20).compareTo(originals.workspace("mine",sent.getHeldNumber()).bills().getFirst().getNetTotal()));
  var original=originals.read(records.findById(sent.getId()).orElseThrow());assertEquals(0,BigDecimal.valueOf(2).compareTo(original.getItems().getFirst().getQuantity()));assertEquals(0,BigDecimal.valueOf(20).compareTo(original.getNetTotal()));
  var merged=invoices.completeHeldInvoices(List.of(sent.getId())).getFirst();
  assertEquals(0,BigDecimal.valueOf(20).compareTo(records.getCustomerPerformanceBetween(f.customer,null,null)),"Original and merged invoice must count once");
  assertEquals(1,records.countCustomerPerformanceBetween(f.customer,null,null));
  workflow.reprint(sent.getId(),null);
  assertEquals("BILLED",originals.workspace("mine",sent.getHeldNumber()).bills().getFirst().getStatus());
  var liveMerged=invoices.heldWorkspace("mine",sent.getHeldNumber(),null).bills().getFirst();
  assertEquals("INVOICE_CREATED",liveMerged.getStatus());
  assertEquals(0,BigDecimal.TEN.compareTo(liveMerged.getNetTotal()));
  invoices.voidInvoice(merged.getId(),"Original order cancelled after invoicing");
  assertEquals(0,records.getCustomerPerformanceBetween(f.customer,null,null).signum());
  var cancelledLive=invoices.getInvoiceById(sent.getId());assertEquals("Original order cancelled after invoicing",cancelledLive.getCancellationReason());
  var cancelledCopy=originals.workspace("mine",sent.getHeldNumber()).bills().getFirst();
  assertEquals("CANCELLED",cancelledCopy.getStatus());
  assertEquals(0,BigDecimal.valueOf(20).compareTo(cancelledCopy.getNetTotal()));
  assertEquals("INVOICE_CANCELLED",invoices.heldWorkspace("mine",sent.getHeldNumber(),null,true).bills().getFirst().getStatus());
  assertEquals("INVOICE_CANCELLED",invoices.getInvoiceById(sent.getId()).getStatus());
  assertEquals("INVOICE_CANCELLED",invoices.heldWorkspace("mine",sent.getHeldNumber(),null).bills().getFirst().getStatus());
 }
 @Test void savedOnholdCancellationRequiresReasonAndReleasesReservationsAndQueuedSheets(){
  ready(invoices.createInvoice(held(fixture(),1)));var f=fixture();var draft=invoices.createInvoice(held(f,2));
  var pending=workflow.send(draft.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),"held-admin",false));
  assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(pending.getId()));
  assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(pending.getId(),"",pending.getRecordVersion()));
  invoices.cancelHeldInvoice(pending.getId(),"Customer requested cancellation",pending.getRecordVersion());
  var cancelled=invoices.getInvoiceById(pending.getId());assertEquals("CANCELLED",cancelled.getStatus());assertEquals("Customer requested cancellation",cancelled.getCancellationReason());assertEquals("CANCELLED",originals.workspace("mine",pending.getHeldNumber()).bills().getFirst().getStatus());
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));

  assertNotNull(records.findById(pending.getId()).orElseThrow().getOriginalHeldSnapshot());
 }
 @Test void heldNumbersDoNotConsumeInvoiceNumbersAndMergeCreatesOneInvoice(){
  var f=fixture();var a=invoices.createInvoice(held(f,2));var b=invoices.createInvoice(held(f,3));
  assertNull(a.getInvoiceNumber());assertNull(b.getInvoiceNumber());assertTrue(a.getHeldNumber().startsWith("HLD-"));assertNotEquals(a.getHeldNumber(),b.getHeldNumber());
  long before=records.countByStatusIn(Set.of("COMPLETED","PAID","PARTIAL"));
  ready(a);ready(b);var preview=invoices.previewHeldMerge(List.of(a.getId(),b.getId()));assertEquals(0,BigDecimal.valueOf(50).compareTo(preview.totalAmount()));
  var result=invoices.completeHeldInvoices(List.of(a.getId(),b.getId()));assertEquals(1,result.size());var invoice=result.getFirst();
  assertTrue(invoice.getInvoiceNumber().startsWith("INV-"));assertNull(invoice.getHeldNumber());assertEquals(before+1,records.countByStatusIn(Set.of("COMPLETED","PAID","PARTIAL")));
  assertEquals("PENDING",invoice.getPaymentStatus());assertEquals("PENDING",invoice.getDeliveryStatus());assertEquals(0,invoice.getPaidAmount().signum());
  assertEquals(0,BigDecimal.valueOf(50).compareTo(invoice.getNetTotal()));assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  var source=records.findById(a.getId()).orElseThrow();assertEquals("MERGED",source.getStatus());assertEquals(invoice.getId(),source.getMergedInvoiceId());assertNull(source.getInvoiceNumber());
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(a.getId(),b.getId())));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  invoices.voidInvoice(invoice.getId(),"Merged order cancelled");
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,customers.findById(f.customer).orElseThrow().getCurrentBalance().signum());
 }
 @Test void failedCreditCheckRollsBackSourceBillsAndTheirStock(){
  var f=fixture();var customer=customers.findById(f.customer).orElseThrow();customer.setCreditLimit(BigDecimal.TEN);customers.saveAndFlush(customer);
  var bill=ready(invoices.createInvoice(held(f,2)));long count=records.count();
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(bill.getId())));
  assertEquals(count,records.count());assertEquals("STOCK_ADJUSTED",records.findById(bill.getId()).orElseThrow().getStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void staleMergePreviewDoesNotInvoiceChangedHeldBills(){
  var f=fixture();var bill=ready(invoices.createInvoice(held(f,2)));var preview=invoices.previewHeldMerge(List.of(bill.getId()));
  var change=new com.nbh.erp.sales.dto.UpdateInvoiceRequest();change.setNotes("Office added a note after preview");assertThrows(BusinessException.class,()->invoices.updateInvoice(bill.getId(),change));
  var changed=records.findById(bill.getId()).orElseThrow();changed.setNotes("Concurrent office update");records.saveAndFlush(changed);
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(preview.sourceBillIds(),preview.expectedVersions()));
  assertEquals("STOCK_ADJUSTED",records.findById(bill.getId()).orElseThrow().getStatus());
 }
 @Test void invalidMergeLeavesBothHeldBillsAndReservationsIntact(){
  var f=fixture();var other=fixture();var a=invoices.createInvoice(held(f,2));var b=invoices.createInvoice(held(other,3));
  assertThrows(BusinessException.class,()->invoices.completeHeldInvoices(List.of(a.getId(),b.getId())));
  assertEquals("HELD",records.findById(a.getId()).orElseThrow().getStatus());assertEquals("HELD",records.findById(b.getId()).orElseThrow().getStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void unchangedWarehouseReviewCreatesNoStockAdjustment(){
  var f=fixture();long before=adjustmentRecords.count();
  var reviewed=ready(invoices.createInvoice(held(f,2)));
  assertEquals("STOCK_ADJUSTED",reviewed.getStatus());assertEquals(before,adjustmentRecords.count());
  assertEquals(0,BigDecimal.valueOf(2).compareTo(reviewed.getItems().getFirst().getQuantity()));
  assertEquals(0,BigDecimal.valueOf(20).compareTo(reviewed.getNetTotal()));
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void posRemarksSurviveDraftRetryAndOriginalHeldCopy(){
  var f=fixture();var request=held(f,2);request.setNotes("");
  var draft=invoices.createInvoice(request);assertEquals("",draft.getNotes());
  request.setNotes("Deliver after 3 pm");request.setExpectedVersion(draft.getRecordVersion());
  var updated=invoices.savePosDraft(draft.getId(),request);assertEquals("Deliver after 3 pm",updated.getNotes());
  var submitted=ready(updated);assertTrue(submitted.getNotes().contains("Warehouse review:"));
  var detail=invoices.getInvoiceById(submitted.getId());assertEquals("Deliver after 3 pm",detail.getPosRemarks());
  assertEquals("Deliver after 3 pm",invoices.heldWorkspace("mine",submitted.getHeldNumber(),null).bills().getFirst().getPosRemarks());
  assertEquals("Deliver after 3 pm",originals.workspace("mine",submitted.getHeldNumber()).bills().getFirst().getPosRemarks());
  invoices.cancelHeldInvoice(submitted.getId(),"Customer postponed delivery",detail.getRecordVersion());
  var cancelled=invoices.getInvoiceById(submitted.getId());assertEquals("Deliver after 3 pm",cancelled.getPosRemarks());assertEquals("Customer postponed delivery",cancelled.getCancellationReason());
  var copy=originals.workspace("mine",submitted.getHeldNumber()).bills().getFirst();assertEquals("Deliver after 3 pm",copy.getPosRemarks());assertEquals("Customer postponed delivery",copy.getCancellationReason());
 }
 @Test void allHeldBillsScopeIncludesMyBillsAndOtherStaffBills(){
  var f=fixture();String owner="scope-"+UUID.randomUUID();principal(owner,true);
  var mine=ready(invoices.createInvoice(held(f,2)));
  principal("other-"+owner,true);var other=ready(invoices.createInvoice(held(f,3)));
  principal(owner,true);
  assertEquals(List.of(mine.getId()),originals.workspace("mine",mine.getHeldNumber()).bills().stream().map(com.nbh.erp.sales.dto.InvoiceDto::getId).toList());
  assertTrue(originals.workspace("others",other.getHeldNumber()).bills().stream().anyMatch(b->b.getId().equals(other.getId())));
  var all=originals.workspace("all","").bills().stream().map(com.nbh.erp.sales.dto.InvoiceDto::getId).toList();
  assertTrue(all.containsAll(List.of(mine.getId(),other.getId())));
  assertEquals(List.of(other.getId()),originals.workspace("all",other.getHeldNumber()).bills().stream().map(com.nbh.erp.sales.dto.InvoiceDto::getId).toList());
  var live=invoices.heldWorkspace("all","",null).bills().stream().map(com.nbh.erp.sales.dto.InvoiceDto::getId).toList();
  assertTrue(live.containsAll(List.of(mine.getId(),other.getId())));
  assertFalse(invoices.heldWorkspace("mine",other.getHeldNumber(),null).bills().stream().anyMatch(b->b.getId().equals(other.getId())));
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
 @Test void multiWarehouseReviewIssuesStockAndMergeDoesNotDeductAgain(){
  var first=fixture();var second=fixture();var request=held(first,2);
  request.setItems(List.of(
    CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(first.product).warehouseId(first.warehouse).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build(),
    CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(second.product).warehouseId(second.warehouse).quantity(BigDecimal.valueOf(3)).unitPrice(BigDecimal.TEN).build()));
  var bill=invoices.createInvoice(request);
  assertThrows(BusinessException.class,()->invoices.previewHeldMerge(List.of(bill.getId())));
  ready(invoices.createInvoice(held(fixture(),1))); // Ensure the responsible user exists.
  var sent=workflow.send(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(),"held-admin"));
  assertEquals("SENT_TO_WAREHOUSE",sent.getStatus());



  var delivered=printed(sent);
  var lines=delivered.getItems().stream().map(i->new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(i.getId(),i.getWarehouseId().equals(first.warehouse)?BigDecimal.ONE:BigDecimal.valueOf(2),null)).toList();
  var review=new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(delivered.getRecordVersion(),"Warehouse signed sheets checked",lines);
  var reviewed=workflow.review(bill.getId(),review);assertEquals("STOCK_ADJUSTED",reviewed.getStatus());
  assertEquals(0,BigDecimal.valueOf(9).compareTo(stock.getStockBalance(first.warehouse,first.product).getQuantity()));
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getStockBalance(second.warehouse,second.product).getQuantity()));
  assertEquals(0,stock.getStockBalance(first.warehouse,first.product).getReservedQuantity().signum());
  assertEquals(0,stock.getStockBalance(second.warehouse,second.product).getReservedQuantity().signum());
  var bypass=new com.nbh.erp.sales.dto.UpdateInvoiceRequest();bypass.setDiscountAmount(BigDecimal.ONE);
  assertThrows(BusinessException.class,()->invoices.updateInvoice(bill.getId(),bypass));
  assertEquals(0,BigDecimal.valueOf(9).compareTo(stock.getAvailableStock(first.warehouse,first.product)));
  assertThrows(BusinessException.class,()->workflow.review(bill.getId(),review));
  assertEquals(0,adjustmentRecords.findAll().stream().filter(a->bill.getId().equals(a.getSourceHeldBillId())).count());
  var invoice=invoices.completeHeldInvoices(List.of(bill.getId())).getFirst();assertEquals(2,invoice.getItems().size());
  assertEquals(0,BigDecimal.valueOf(9).compareTo(stock.getAvailableStock(first.warehouse,first.product)));
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(second.warehouse,second.product)));
  assertTrue(invoices.heldWorkspace("mine","",null,true).bills().stream().anyMatch(b->b.getId().equals(bill.getId())));
  assertEquals(List.of(bill.getHeldNumber()),invoices.getInvoiceById(invoice.getId()).getSourceHeldNumbers());
  invoices.voidInvoice(invoice.getId(),"Test multiwarehouse restoration");
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(first.warehouse,first.product)));
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(second.warehouse,second.product)));
 }
 @Test void physicalCountIsRejectedAndSalesEditorsCanReviewAnotherCashiersBill(){
  var f=fixture();var bill=invoices.createInvoice(held(f,2));ready(invoices.createInvoice(held(fixture(),1)));
  String assignee="review-"+UUID.randomUUID().toString().substring(0,8);
  users.save(com.nbh.erp.user.entity.User.builder().username(assignee).password("test").email(assignee+"@test.example").fullName(assignee).build());
  var sent=printed(workflow.send(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(),assignee)));
  var request=new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Count cannot cover approved quantity",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(sent.getItems().getFirst().getId(),BigDecimal.valueOf(4),BigDecimal.ONE)));
  assertThrows(RuntimeException.class,()->workflow.review(sent.getId(),request));
  assertEquals("SENT_TO_WAREHOUSE",invoices.getInvoiceById(sent.getId()).getStatus());
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertFalse(adjustmentRecords.findAll().stream().anyMatch(a->bill.getId().equals(a.getSourceHeldBillId())));
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(assignee,null,List.of(new SimpleGrantedAuthority("SALES_EDIT"))));
  assertNull(invoices.getInvoiceById(sent.getId()).getAssignedStaff());
  assertTrue(invoices.heldWorkspace("others","",null).bills().stream().anyMatch(b->b.getId().equals(bill.getId()) && Boolean.TRUE.equals(b.getCanResume())));
  var valid=new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Signed sheet unchanged",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(sent.getItems().getFirst().getId(),BigDecimal.valueOf(2),null)));
  principal("unprivileged-reviewer",false);
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->workflow.review(sent.getId(),valid));
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->invoices.previewHeldMerge(List.of(sent.getId())));
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(assignee,null,List.of(new SimpleGrantedAuthority("SALES_EDIT"))));
  var reviewed=workflow.review(sent.getId(),valid);
  assertEquals(assignee,reviewed.getReviewedBy());
  var preview=invoices.previewHeldMerge(List.of(sent.getId()));
  var merged=invoices.completeHeldInvoices(preview.sourceBillIds(),preview.expectedVersions()).getFirst();
  assertEquals("PENDING",merged.getDeliveryStatus());
  assertEquals(0,BigDecimal.valueOf(20).compareTo(merged.getBalanceAmount()));
 }
 @Test void sameProductInTwoWarehousesReservesAndReturnsToItsOriginalWarehouse(){
  var f=fixture();var other=fixture();
  stock.increaseStock(other.warehouse,f.product,BigDecimal.TEN,BigDecimal.ONE,"GRN","TWO-WH","Opening stock");
  var request=held(f,2);request.setItems(List.of(
    CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(f.product).warehouseId(f.warehouse).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build(),
    CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(f.product).warehouseId(other.warehouse).quantity(BigDecimal.valueOf(3)).unitPrice(BigDecimal.TEN).build()));
  var reviewed=ready(invoices.createInvoice(request));
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,BigDecimal.valueOf(7).compareTo(stock.getAvailableStock(other.warehouse,f.product)));
  var invoice=invoices.completeHeldInvoices(List.of(reviewed.getId())).getFirst();
  var line=invoice.getItems().stream().filter(i->i.getWarehouseId().equals(other.warehouse)).findFirst().orElseThrow();
  var refund=new com.nbh.erp.salesreturn.dto.CreateSalesReturnRequest();refund.setInvoiceId(invoice.getId());refund.setReturnType("CREDIT_NOTE");refund.setReason("Warehouse-specific return");
  var item=new com.nbh.erp.salesreturn.dto.CreateSalesReturnRequest.CreateSalesReturnItemRequest();item.setInvoiceItemId(line.getId());item.setProductId(f.product);item.setQuantity(BigDecimal.ONE);refund.setItems(List.of(item));
  returns.createSalesReturn(refund);
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(other.warehouse,f.product)));
 }
 void removedPrinterTest() throws Exception { /* Removed office printer test
  var first=fixture();var second=fixture();ready(invoices.createInvoice(held(fixture(),1)));
  var request=held(first,2);request.setItems(List.of(
   CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(first.product).warehouseId(first.warehouse).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build(),
   CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(second.product).warehouseId(second.warehouse).quantity(BigDecimal.ONE).unitPrice(BigDecimal.TEN).build()));
  var office=new com.nbh.erp.sales.entity.OfficePrinter();office.setId(1L);office.setPrinterName("Office Wi-Fi A4");officePrinters.save(office);
  var bill=invoices.createInvoice(request);var queued=workflow.send(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(),"held-admin"));
  assertEquals("YET_TO_PRINT",queued.getStatus());assertTrue(invoices.heldWorkspace("mine","",null).bills().stream().anyMatch(b->b.getId().equals(bill.getId())));
  assertThrows(BusinessException.class,()->invoices.previewHeldMerge(List.of(bill.getId())));
  assertThrows(BusinessException.class,()->workflow.review(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(queued.getRecordVersion(),"Too early",List.of())));
  var transport=mock(com.nbh.erp.sales.service.OfficePrinterTransport.class);
  var worker=new com.nbh.erp.sales.service.WarehousePrintWorker(printJobs,officePrinters,transactions,businessClock,transport,records,progress);
  var jobs=printJobs.findByBillIdOrderByIdDesc(bill.getId());
  worker.submit(jobs.getFirst().getId());assertEquals("YET_TO_PRINT",invoices.getInvoiceById(bill.getId()).getStatus());
  doThrow(new java.awt.print.PrinterException("Office printer offline")).when(transport).submit(anyString(),anyString(),anyString());
  worker.submit(jobs.getLast().getId());assertEquals("FAILED",printJobs.findById(jobs.getLast().getId()).orElseThrow().getStatus());
  assertEquals("YET_TO_PRINT",invoices.getInvoiceById(bill.getId()).getStatus());
  workflow.retryPrinting(bill.getId());assertEquals(2,printJobs.findByBillIdOrderByIdDesc(bill.getId()).size());
  assertEquals("SUBMITTED",printJobs.findById(jobs.getFirst().getId()).orElseThrow().getStatus());
  reset(transport);worker.submit(jobs.getLast().getId());
  assertEquals("SENT_TO_WAREHOUSE",invoices.getInvoiceById(bill.getId()).getStatus());
  verify(transport).submit(eq("Office Wi-Fi A4"),anyString(),anyString());*/
 }
 @Test void removingAProductReleasesItsStockAndIssuesOnlyApprovedProducts(){
  var first=fixture();var second=fixture();ready(invoices.createInvoice(held(fixture(),1)));
  var req=held(first,2);req.setItems(List.of(
   CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(first.product).warehouseId(first.warehouse).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build(),
   CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(second.product).warehouseId(second.warehouse).quantity(BigDecimal.valueOf(3)).unitPrice(BigDecimal.TEN).build()));
  var original=invoices.createInvoice(req);var sent=printed(workflow.send(original.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(original.getRecordVersion(),"held-admin")));
  var result=workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Remove unavailable product",sent.getItems().stream().map(i->new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(i.getId(),i.getProductId().equals(first.product)?BigDecimal.ZERO:BigDecimal.ONE,null)).toList()));
  assertEquals("STOCK_ADJUSTED",result.getStatus());assertEquals(1,result.getItems().size());
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getStockBalance(first.warehouse,first.product).getQuantity()));
  assertEquals(0,BigDecimal.valueOf(9).compareTo(stock.getStockBalance(second.warehouse,second.product).getQuantity()));
  var evidence=adjustmentRecords.findAll().stream().filter(a->original.getId().equals(a.getSourceHeldBillId())).toList();assertTrue(evidence.isEmpty());
 }

 @Test void reviewedSaleCancellationRestoresStockOnceBeforeMerge(){
  var f=fixture();var reviewed=ready(invoices.createInvoice(held(f,3)));
  assertEquals(0,BigDecimal.valueOf(7).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertTrue(records.findById(reviewed.getId()).orElseThrow().getStockDeducted());
  invoices.cancelHeldInvoice(reviewed.getId(),"Cancelled reviewed sale",reviewed.getRecordVersion());
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,stock.getStockBalance(f.warehouse,f.product).getReservedQuantity().signum());
  assertFalse(records.findById(reviewed.getId()).orElseThrow().getStockDeducted());
  assertThrows(BusinessException.class,()->invoices.cancelHeldInvoice(reviewed.getId(),"Again",reviewed.getRecordVersion()));
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void voidingReviewedSaleRestoresStockBeforeMerge(){
  var f=fixture();var reviewed=ready(invoices.createInvoice(held(f,3)));
  invoices.voidInvoice(reviewed.getId(),"Void reviewed sale");
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,stock.getStockBalance(f.warehouse,f.product).getReservedQuantity().signum());
 }
 @Test void mergeCombinesLegacyReservedAndAlreadyIssuedReviewedBills(){
  var f=fixture();var legacy=invoices.createInvoice(held(f,2));
  transactions.executeWithoutResult(status->{var record=records.findById(legacy.getId()).orElseThrow();record.setStatus("STOCK_ADJUSTED");records.saveAndFlush(record);});
  var reviewed=ready(invoices.createInvoice(held(f,3)));
  assertEquals(0,BigDecimal.valueOf(7).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getAvailableStock(f.warehouse,f.product)));
  var merged=invoices.mergeHeldBills(List.of(legacy.getId(),reviewed.getId()));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,stock.getStockBalance(f.warehouse,f.product).getReservedQuantity().signum());
  invoices.voidInvoice(merged.getId(),"Void combined invoice");
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(f.warehouse,f.product)));
 }
 @Test void otherStaffCanBillReleasedStockAfterReviewReducesQuantity(){
  var f=fixture();var bill=invoices.createInvoice(held(f,8));
  var sent=workflow.send(bill.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(),null));
  var reviewed=workflow.review(sent.getId(),new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewRequest(sent.getRecordVersion(),"Approve five",List.of(new com.nbh.erp.sales.service.HeldWarehouseWorkflow.ReviewLine(sent.getItems().getFirst().getId(),BigDecimal.valueOf(5),null))));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  principal("another-staff",true);
  var other=invoices.createInvoice(held(f,5));
  assertEquals(0,stock.getAvailableStock(f.warehouse,f.product).signum());
  principal("held-admin",true);
  invoices.mergeHeldBills(List.of(reviewed.getId()));
  assertEquals(0,BigDecimal.valueOf(5).compareTo(stock.getStockBalance(f.warehouse,f.product).getQuantity()));
  assertEquals(0,stock.getAvailableStock(f.warehouse,f.product).signum());
  assertEquals(0,BigDecimal.valueOf(5).compareTo(invoices.getInvoiceById(other.getId()).getItems().getFirst().getQuantity()));
 }
}
