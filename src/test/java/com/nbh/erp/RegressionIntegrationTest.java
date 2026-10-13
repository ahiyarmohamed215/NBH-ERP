package com.nbh.erp;
import com.nbh.erp.sales.dto.*;
import com.nbh.erp.sales.service.*;
import com.nbh.erp.sales.repository.*;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.payment.service.PaymentService;
import com.nbh.erp.payment.dto.CreatePaymentRequest;
import com.nbh.erp.salesreturn.service.SalesReturnService;
import com.nbh.erp.salesreturn.dto.CreateSalesReturnRequest;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.purchaseorder.service.PurchaseOrderService;
import com.nbh.erp.purchaseorder.dto.PurchaseOrderRequest;
import com.nbh.erp.security.*;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.role.repository.RoleRepository;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
@SpringBootTest @Transactional
class RegressionIntegrationTest {
 @Autowired InvoiceService invoices; @Autowired InvoiceRepository invoiceRepository;
 @Autowired CustomerRepository customers; @Autowired WarehouseRepository warehouses; @Autowired ProductRepository products; @Autowired CategoryRepository categories;
 @Autowired SupplierRepository suppliers; @Autowired PaymentService payments; @Autowired SalesReturnService returns; @Autowired StockService stock;
 @Autowired PurchaseOrderService orders; @Autowired UserRepository users; @Autowired RoleRepository roles;
 @Autowired JwtTokenProvider tokens; @Autowired PasswordEncoder passwords; @Autowired WebApplicationContext context;
 @Autowired com.nbh.erp.auth.service.AuthService auth;
 @Autowired com.nbh.erp.grn.service.GrnService grns;
 @Autowired com.nbh.erp.brand.service.BrandService brandService;
 @Autowired com.nbh.erp.brand.repository.BrandRepository brands;
 @Autowired com.nbh.erp.payment.service.SupplierPaymentService supplierPayments;
 @Autowired com.nbh.erp.purchasereturn.service.PurchaseReturnService purchaseReturns;
 @Autowired com.nbh.erp.inventory.repository.ProductStaffQuotaRepository quotas;
 @Autowired com.nbh.erp.stockadjustment.service.StockAdjustmentService adjustments;

 Customer customer; Warehouse warehouse; Product product; Supplier supplier; User admin; MockMvc mvc;
 static BigDecimal n(String s) { return new BigDecimal(s); }
 @BeforeEach void setup() {
  mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  admin=User.builder().username("regression-admin").email("regression@test.local").fullName("Regression").password(passwords.encode("safe-test-password")).isActive(true).approvalStatus("APPROVED").roles(new HashSet<>(List.of(roles.findByName("ROLE_ADMIN").orElseThrow()))).build(); users.save(admin);
  principal(admin);
  customer=customers.save(Customer.builder().customerCode("REG-C").name("Regression customer").creditLimit(n("10000")).currentBalance(BigDecimal.ZERO).isActive(true).build());
  warehouse=warehouses.save(Warehouse.builder().code("REG-W").name("Regression warehouse").isActive(true).build());
  Category category=categories.save(Category.builder().code("REG-CAT").name("Regression category").build());
  product=products.save(Product.builder().sku("REG-P").name("Regression product").category(category).defaultWarehouse(warehouse).sellingPrice(n("10")).costPrice(n("4")).isActive(true).build());
  supplier=suppliers.save(Supplier.builder().supplierCode("REG-S").name("Regression supplier").isActive(true).build());
  stock.increaseStock(warehouse.getId(),product.getId(),n("100"),n("4"),"GRN","REG-OPEN","Test stock");
 }
 void principal(User u) { var p=UserPrincipal.create(u); SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities())); }
 @AfterEach void cleanup() { SecurityContextHolder.clearContext(); org.springframework.web.context.request.RequestContextHolder.resetRequestAttributes(); }
 CreateInvoiceRequest sale(boolean held) { return CreateInvoiceRequest.builder().customerId(customer.getId()).warehouseId(warehouse.getId()).paymentType("CREDIT").paidAmount(BigDecimal.ZERO).hold(held).items(List.of(CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(product.getId()).quantity(n("2")).unitPrice(n("10")).build())).build(); }
 @Test void inactiveCustomerIsHiddenAndExistingDocumentsCannotBeUsed() {
  var invoice = invoices.createInvoice(sale(false));
  var held = invoices.createInvoice(sale(true));
  var advance = payments.processPayment(CreatePaymentRequest.builder().customerId(customer.getId()).amount(n("50")).build());
  customer.setIsActive(false); customers.saveAndFlush(customer);
  var customerService = context.getBean(com.nbh.erp.customer.service.CustomerService.class);
  assertTrue(customerService.getAllCustomers().stream().noneMatch(c -> c.getId().equals(customer.getId())));
  assertTrue(customerService.searchCustomers("Regression customer").isEmpty());
  assertThrows(RuntimeException.class, () -> customerService.getCustomerById(customer.getId()));
  assertThrows(RuntimeException.class, () -> customers.requireActiveCustomers(List.of(customer.getId())));
  assertThrows(RuntimeException.class, () -> invoices.createInvoice(sale(false)));
  assertThrows(RuntimeException.class, () -> invoices.getInvoiceById(invoice.getId()));
  assertThrows(RuntimeException.class, () -> invoices.cancelHeldInvoice(held.getId()));
  assertThrows(RuntimeException.class, () -> payments.processPayment(CreatePaymentRequest.builder().invoiceId(invoice.getId()).amount(n("5")).build()));
  assertThrows(RuntimeException.class, () -> payments.allocateAdvance(advance.getId(), invoice.getId(), n("5")));
  assertThrows(RuntimeException.class, () -> payments.voidPayment(advance.getId(), "Reversal"));
  assertThrows(RuntimeException.class, () -> returns.createSalesReturn(returnRequest(invoice, "1")));
  assertTrue(invoices.searchInvoices(null, customer.getId(), null, null, null, null, null, null, org.springframework.data.domain.PageRequest.of(0, 20)).getContent().isEmpty());
  assertTrue(payments.searchPayments(customer.getId(), null, null, null, null, null, null, null, org.springframework.data.domain.PageRequest.of(0, 20)).getContent().isEmpty());
  assertTrue(customers.findById(customer.getId()).isPresent(), "Historical records remain stored");
 }
 @Test void accountingEndpointsAreRemovedAndCashierSummaryStillWorks() throws Exception {
  var mapping=context.getBean("requestMappingHandlerMapping",org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping.class);
  assertTrue(mapping.getHandlerMethods().keySet().stream().flatMap(info->info.getPatternValues().stream()).noneMatch(path->path.contains("/accounting")));
  mvc.perform(get("/api/v1/invoices/cashiers/summary")).andExpect(status().isOk());
 }
 @Test void heldCompletionWithoutLinesDeductsStockAndPostsDebt() {
  var invoice=invoices.createInvoice(sale(true)); assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  var update=new UpdateInvoiceRequest(); update.setStatus("COMPLETED"); update.setPaidAmount(BigDecimal.ZERO);
  invoices.updateInvoice(invoice.getId(),update);
  assertEquals(0,n("98").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,n("20").compareTo(customers.findById(customer.getId()).orElseThrow().getCurrentBalance()));
  invoices.updateInvoice(invoice.getId(),update); assertEquals(0,n("98").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void postedTotalsCannotBeOverwritten() { var invoice=invoices.createInvoice(sale(false)); var update=new UpdateInvoiceRequest();update.setTotalAmount(n("1"));assertThrows(RuntimeException.class,()->invoices.updateInvoice(invoice.getId(),update)); }
 @Test void overpaymentRejected() { var invoice=invoices.createInvoice(sale(false)); assertThrows(RuntimeException.class,()->payments.processPayment(CreatePaymentRequest.builder().invoiceId(invoice.getId()).amount(n("21")).build())); }
 @Test void unknownInvoiceDoesNotBecomeAdvance() { assertThrows(RuntimeException.class,()->payments.processPayment(CreatePaymentRequest.builder().invoiceNumber("DOES-NOT-EXIST").customerId(customer.getId()).amount(n("10")).build())); }
 @Test void advanceAndVoidDoNotInventDebt() { var payment=payments.processPayment(CreatePaymentRequest.builder().customerId(customer.getId()).amount(n("50")).paymentType("ADVANCE").build());payments.voidPayment(payment.getId(),"Test reversal");assertEquals(0,customers.findById(customer.getId()).orElseThrow().getCurrentBalance().signum()); }
 @Test void advanceAllocationAndReversalReconcileInvoice() { var invoice=invoices.createInvoice(sale(false));var payment=payments.processPayment(CreatePaymentRequest.builder().customerId(customer.getId()).amount(n("50")).build()); payments.allocateAdvance(payment.getId(),invoice.getId(),n("15"));assertEquals(0,n("5").compareTo(invoiceRepository.findById(invoice.getId()).orElseThrow().getBalanceAmount()));payments.voidPayment(payment.getId(),"Test reversal");assertEquals(0,n("20").compareTo(customers.findById(customer.getId()).orElseThrow().getCurrentBalance())); }
 @Test void zeroCreditLimitBlocksDebt() { customer.setCreditLimit(BigDecimal.ZERO); customers.save(customer);assertThrows(RuntimeException.class,()->invoices.createInvoice(sale(false))); }
 CreateSalesReturnRequest returnRequest(InvoiceDto invoice,String quantity) {
  var req=new CreateSalesReturnRequest();req.setInvoiceId(invoice.getId());req.setReturnType("REFUND");
  var line=new CreateSalesReturnRequest.CreateSalesReturnItemRequest();line.setInvoiceItemId(invoice.getItems().get(0).getId());line.setProductId(product.getId());line.setQuantity(n(quantity));line.setUnitPrice(n("9999"));req.setItems(List.of(line));return req;
 }
 @Test void returnUsesOriginalPriceAndReconcilesDebt() { var invoice=invoices.createInvoice(sale(false));var result=returns.createSalesReturn(returnRequest(invoice,"1"));assertEquals(0,n("10").compareTo(result.getTotalAmount()));assertEquals(0,n("10").compareTo(customers.findById(customer.getId()).orElseThrow().getCurrentBalance())); }
 @Test void repeatReturnCannotExceedSale() { var invoice=invoices.createInvoice(sale(false));returns.createSalesReturn(returnRequest(invoice,"2"));assertThrows(RuntimeException.class,()->returns.createSalesReturn(returnRequest(invoice,"1"))); }
 @Test void paidInvoiceAllowsReturn() { var req=sale(false);req.setPaidAmount(n("20"));req.setPaymentType("CASH");var invoice=invoices.createInvoice(req);assertEquals("PAID",invoice.getStatus());assertEquals(0,n("10").compareTo(returns.createSalesReturn(returnRequest(invoice,"1")).getTotalAmount())); }
 @Test void purchaseOrderDateIsAutomaticAndEditsKeepItsCreationTimestamp() {
  var request=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),null,null,null,"Automatic date","DRAFT",List.of(new PurchaseOrderRequest.Line(product.getId(),n("2"),n("4"))));
  var po=orders.save(null,request);assertNotNull(po.createdAt());assertEquals(LocalDate.now(),po.orderDate());assertEquals(po.createdAt().toLocalDate(),po.orderDate());
  var changed=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.of(2000,1,1),null,null,"Updated notes","DRAFT",request.items());
  var updated=orders.save(po.id(),changed);assertEquals(po.orderDate(),updated.orderDate());assertEquals(po.createdAt(),updated.createdAt());assertEquals("Updated notes",updated.notes());
 }
 @Test void purchaseOrdersPersistAndTrackPartialReceipts() { var req=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),LocalDate.now().plusDays(1),"Cash","Test","INFORM_TO_ORDER",List.of(new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4"))));var po=orders.save(null,req);orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(product.getId(),n("2")),false);assertEquals("INFORM_TO_ORDER",orders.get(po.id()).status());assertEquals(0,n("2").compareTo(orders.get(po.id()).items().get(0).receivedQuantity())); }
 @Test void purchaseOrderProductWarehousesAreAutomaticAndSurviveCatalogueChangesThroughReceiptAndReversal() {
  var destination=warehouses.save(Warehouse.builder().code("PO-DELIVERY").name("PO delivery warehouse").isActive(true).build());
  var other=products.save(Product.builder().sku("PO-NOSTOCK").name("Catalogue product without stock").category(product.getCategory()).defaultWarehouse(destination).sellingPrice(n("12")).costPrice(n("7")).isActive(true).build());
  var request=new PurchaseOrderRequest(supplier.getId(),null,LocalDate.now(),null,null,"Order without expected date","INFORM_TO_ORDER",List.of(new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4")),new PurchaseOrderRequest.Line(other.getId(),n("2"),n("7"))));
  var po=orders.save(null,request);assertNull(po.warehouseId());assertNull(po.expectedDate());assertEquals(warehouse.getId(),po.items().getFirst().warehouseId());assertEquals(destination.getId(),po.items().get(1).warehouseId());
  assertEquals(0,n("34").compareTo(po.totalAmount()));assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(destination.getId(),other.getId())));
  other.setDefaultWarehouse(warehouse);products.save(other);assertEquals(destination.getId(),orders.get(po.id()).items().get(1).warehouseId());
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(other.getId(),n("1")),false));
  assertEquals(0,BigDecimal.ZERO.compareTo(orders.get(po.id()).items().get(1).receivedQuantity()));
  var receipt=automaticReceiptRequest();receipt.setPurchaseOrderId(po.id());var second=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();second.setProductId(other.getId());second.setQuantityReceived(n("2"));second.setUnitCost(n("7"));receipt.setItems(List.of(receipt.getItems().getFirst(),second));
  var received=grns.createGrn(receipt,true);assertEquals("INFORM_TO_ORDER",orders.get(po.id()).status());assertEquals(0,n("2").compareTo(stock.getAvailableStock(destination.getId(),other.getId())));assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(warehouse.getId(),other.getId())));
  grns.cancelGrn(received.getId(),"Wrong delivery; reverse linked purchase order receipt");assertEquals("INFORM_TO_ORDER",orders.get(po.id()).status());assertTrue(orders.get(po.id()).items().stream().allMatch(item->item.receivedQuantity().signum()==0));assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(destination.getId(),other.getId())));
 }
 @Test void purchaseOrderMultipleSuppliersKeepTheirOwnDestinationsAndReceiptQuantities() {
  var secondSupplier=suppliers.save(Supplier.builder().supplierCode("PO-SECOND").name("PO second supplier").isActive(true).build());
  var destination=warehouses.save(Warehouse.builder().code("PO-SPLIT-W").name("PO second destination").isActive(true).build());
  var other=products.save(Product.builder().sku("PO-SPLIT-P").name("PO second product").category(product.getCategory()).defaultWarehouse(destination).sellingPrice(n("12")).costPrice(n("7")).isActive(true).build());
  var request=new PurchaseOrderRequest(null,null,LocalDate.now(),null,null,"Multiple suppliers","INFORM_TO_ORDER",List.of(
    new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4"),null,supplier.getId()),
    new PurchaseOrderRequest.Line(other.getId(),n("2"),n("7"),null,secondSupplier.getId()),
    new PurchaseOrderRequest.Line(product.getId(),n("3"),n("4"),null,secondSupplier.getId())));
  var po=orders.save(null,request);assertNull(po.supplierId());assertNull(po.warehouseId());assertTrue(po.supplierName().contains(secondSupplier.getName()));assertEquals(0,n("46").compareTo(po.totalAmount()));
  assertEquals(destination.getId(),orders.deliveryWarehouses(po.id(),secondSupplier.getId()).get(other.getId()).getId());assertFalse(orders.deliveryWarehouses(po.id(),supplier.getId()).containsKey(other.getId()));
  assertEquals(po.id(),orders.search(null,"PO second supplier",org.springframework.data.domain.PageRequest.of(0,20)).getContent().getFirst().id());
  var receipt=automaticReceiptRequest();receipt.setSupplierId(secondSupplier.getId());receipt.setPurchaseOrderId(po.id());
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(other.getId());line.setQuantityReceived(n("2"));line.setUnitCost(n("7"));receipt.setItems(List.of(line));
  var grn=grns.createGrn(receipt,true);assertEquals(0,n("2").compareTo(stock.getAvailableStock(destination.getId(),other.getId())));
  var lines=orders.get(po.id()).items();assertEquals(0,n("2").compareTo(lines.get(1).receivedQuantity()));assertEquals(0,BigDecimal.ZERO.compareTo(lines.getFirst().receivedQuantity()));
  orders.receive(po.id(),secondSupplier.getId(),warehouse.getId(),Map.of(product.getId(),n("1")),false);assertEquals(0,n("1").compareTo(orders.get(po.id()).items().get(2).receivedQuantity()));assertEquals(0,BigDecimal.ZERO.compareTo(orders.get(po.id()).items().getFirst().receivedQuantity()));
  assertEquals("INFORM_TO_ORDER",orders.save(po.id(),request).status());assertEquals(0,n("2").compareTo(orders.get(po.id()).items().get(1).receivedQuantity()));
  orders.receive(po.id(),secondSupplier.getId(),warehouse.getId(),Map.of(product.getId(),n("1")),true);grns.cancelGrn(grn.getId(),"Reverse second supplier delivery");assertTrue(orders.get(po.id()).items().stream().allMatch(item->item.receivedQuantity().signum()==0));
 }
 @Test void refreshCannotAuthenticateApi() throws Exception { String token=tokens.generateRefreshToken(admin.getUsername(),0,"session","token");SecurityContextHolder.clearContext();mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized()); }
 @Test void anonymousPdfIsBlocked() throws Exception { SecurityContextHolder.clearContext();mvc.perform(get("/api/v1/pdf/customers")).andExpect(status().isUnauthorized()); }
 @Test void disabledUserTokenIsRejected() throws Exception { String token=tokens.generateAccessToken(SecurityContextHolder.getContext().getAuthentication());admin.setIsActive(false);users.saveAndFlush(admin);SecurityContextHolder.clearContext();mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized()); }
 @Test void accessTokenCannotRefresh() { var req=new com.nbh.erp.auth.dto.RefreshTokenRequest();req.setRefreshToken(tokens.generateAccessToken(SecurityContextHolder.getContext().getAuthentication()));assertThrows(RuntimeException.class,()->auth.refreshToken(req)); }
 @Test void rotatedRefreshCannotBeReused() { var login=new com.nbh.erp.auth.dto.LoginRequest();login.setUsername(admin.getUsername());login.setPassword("safe-test-password");var response=auth.login(login);var req=new com.nbh.erp.auth.dto.RefreshTokenRequest();req.setRefreshToken(response.getRefreshToken());var rotated=auth.refreshToken(req);assertNotEquals(response.getRefreshToken(),rotated.getRefreshToken());assertThrows(RuntimeException.class,()->auth.refreshToken(req)); }
 @Test void ordinaryUserCannotGrantAdministrator() { var p=UserPrincipal.builder().username("clerk").active(true).authorities(List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("USER_MANAGE"))).build();SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities()));assertThrows(org.springframework.security.access.AccessDeniedException.class,()->SecurityUtils.checkRoleGrant(roles.findByName("ROLE_ADMIN").orElseThrow())); }
 @Test void testSignupAndDuplicateHandling() {
  auth.signup(new com.nbh.erp.auth.dto.SignupRequest("testnewuser", "secret123", "testnewuser@example.com", "New User", "0771234567"));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class, () ->
      auth.signup(new com.nbh.erp.auth.dto.SignupRequest("testnewuser", "secret123", "other@example.com", "Other", "0771234567")));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class, () ->
      auth.signup(new com.nbh.erp.auth.dto.SignupRequest("differentuser", "secret123", "testnewuser@example.com", "Other", "0771234567")));
 }


 @Test void duplicateInvoiceRetryDoesNotPostTwice() {
  var request=new org.springframework.mock.web.MockHttpServletRequest();request.addHeader("Idempotency-Key","same-invoice");
  org.springframework.web.context.request.RequestContextHolder.setRequestAttributes(new org.springframework.web.context.request.ServletRequestAttributes(request));
  var one=invoices.createInvoice(sale(false));var two=invoices.createInvoice(sale(false));
  assertEquals(one.getId(),two.getId());assertEquals(0,n("98").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void duplicateLinesCannotExceedStaffQuota() {
  quotas.save(com.nbh.erp.inventory.entity.ProductStaffQuota.builder().product(product).user(admin).warehouse(warehouse).allocatedQuantity(n("3")).soldQuantity(BigDecimal.ZERO).build());
  var req=sale(false);req.setItems(List.of(req.getItems().get(0),req.getItems().get(0)));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->invoices.createInvoice(req));
 }
 @Test void otherCashierCannotReadInvoice() {
  var invoice=invoices.createInvoice(sale(false));
  var p=UserPrincipal.builder().username("other-clerk").active(true).authorities(List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("SALES_VIEW"))).build();
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities()));
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->invoices.getInvoiceById(invoice.getId()));
 }
 @Test void voidReconcilesDebtAndStockOnce() {
  var invoice=invoices.createInvoice(sale(false));invoices.voidInvoice(invoice.getId(),"Cancelled sale");
  assertEquals(0,customers.findById(customer.getId()).orElseThrow().getCurrentBalance().signum());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->invoices.voidInvoice(invoice.getId(),"Retry"));
 }
 com.nbh.erp.grn.dto.CreateGrnRequest automaticReceiptRequest() {
  var req=new com.nbh.erp.grn.dto.CreateGrnRequest();
  req.setSupplierId(supplier.getId());req.setReceivedDate(LocalDate.now());req.setGrnType("Import Shipment");req.setNotes("Container 42");
  req.setStatusReason("Receipt validated for processing");
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(product.getId());line.setQuantityReceived(n("5"));line.setUnitCost(n("4"));req.setItems(List.of(line));
  return req;
 }
 @Test void grnNumbersAreGeneratedAutomaticallyAndRemainOnEdit() {
  var request=automaticReceiptRequest();var first=grns.createGrn(request,false);
  request.setNotes("Second receipt");var second=grns.createGrn(request,false);
  assertTrue(first.getGrnNumber().startsWith("GRN-"));assertTrue(second.getGrnNumber().startsWith("GRN-"));
  assertNotEquals(first.getGrnNumber(),second.getGrnNumber());
  request.setNotes("Edited receipt");var edited=grns.updateGrn(first.getId(),request,false);
  assertEquals(first.getGrnNumber(),edited.getGrnNumber());
 }
 @Test void duplicateGrnProductsMergeOnCreateAndDraftUpdate() {
  var req=automaticReceiptRequest();
  var extra=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();extra.setProductId(product.getId());extra.setQuantityReceived(n("5"));extra.setUnitCost(n("6"));
  req.setItems(List.of(req.getItems().getFirst(),extra));
  var draft=grns.createGrn(req,false);
  assertEquals(1,draft.getItems().size());assertEquals(0,n("10").compareTo(draft.getItems().getFirst().getQuantityReceived()));
  assertEquals(0,n("5").compareTo(draft.getItems().getFirst().getUnitCost()));assertEquals(0,n("50").compareTo(draft.getTotalAmount()));
  var posted=grns.updateGrn(draft.getId(),req,true);
  assertEquals(1,posted.getItems().size());assertEquals(0,n("50").compareTo(posted.getTotalAmount()));
  assertEquals(0,n("110").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void openingStockAdjustmentEstablishesMissingCostAndBrandSellingPrice() {
  var brand=brands.save(com.nbh.erp.brand.entity.Brand.builder().code("OPEN-B").name("Opening brand").markupPercent(n("25")).build());
  product.setBrand(brand);product.setCostPrice(BigDecimal.ZERO);product.setSellingPrice(BigDecimal.ZERO);product.setUseBrandMarkup(true);products.save(product);
  var request=new com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest();request.setWarehouseId(warehouse.getId());request.setAdjustmentDate(LocalDate.now());request.setReason("Opening cost correction");
  var item=new com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest.CreateStockAdjustmentItemRequest();item.setProductId(product.getId());item.setPhysicalQuantity(n("100"));item.setUnitCost(n("100"));request.setItems(List.of(item));
  var draft=adjustments.createAdjustment(request,false);
  assertEquals(0,products.findById(product.getId()).orElseThrow().getCostPrice().signum());
  assertEquals(0,n("100").compareTo(draft.getItems().getFirst().getUnitCost()));
  adjustments.processAdjustment(draft.getId());
  var stockItem=stock.getStockBalance(warehouse.getId(),product.getId());
  assertEquals(0,n("100").compareTo(stockItem.getCostPrice()));assertEquals(0,n("125").compareTo(stockItem.getSellingPrice()));assertEquals(0,n("100").compareTo(stockItem.getQuantity()));
 }
 @Test void receiptPricingPublishesAutomaticAndManualPricesOnlyWhenProcessed() {
  var brand=brands.save(com.nbh.erp.brand.entity.Brand.builder().code("PRICE-B").name("Pricing brand").markupPercent(n("25")).build());
  product.setBrand(brand);products.save(product);
  var request=automaticReceiptRequest();var line=request.getItems().getFirst();
  line.setUseBrandMarkup(true);line.setUnitCost(n("100"));
  var draft=grns.createGrn(request,false);
  assertEquals(0,n("10").compareTo(products.findById(product.getId()).orElseThrow().getSellingPrice()));
  grns.processGrn(draft.getId(),"Receipt verified");
  assertEquals(0,n("125").compareTo(products.findById(product.getId()).orElseThrow().getSellingPrice()));
  var brandUpdate=new com.nbh.erp.brand.dto.UpdateBrandRequest();brandUpdate.setName("Pricing brand");brandUpdate.setMarkupPercent(n("30"));
  brandService.updateBrand(brand.getId(),brandUpdate);
  assertEquals(0,n("130").compareTo(products.findById(product.getId()).orElseThrow().getSellingPrice()));
  line.setUseBrandMarkup(false);line.setSellingPrice(n("145"));
  grns.updateGrn(draft.getId(),request,false);
  assertEquals(0,n("145").compareTo(products.findById(product.getId()).orElseThrow().getSellingPrice()));
  brandUpdate.setMarkupPercent(n("50"));brandService.updateBrand(brand.getId(),brandUpdate);
  assertEquals(0,n("145").compareTo(products.findById(product.getId()).orElseThrow().getSellingPrice()));
 }
 @Test void automaticGrnWarehouseAndTypeSurviveDraftEditAndPosting() {
  var req=automaticReceiptRequest();var draft=grns.createGrn(req,false);
  assertEquals(warehouse.getId(),draft.getWarehouseId());assertEquals("Import Shipment",draft.getGrnType());
  req.setGrnType("Direct Purchase");req.setNotes("Updated note");
  var posted=grns.updateGrn(draft.getId(),req,true);
  assertEquals("Direct Purchase",grns.getGrnById(posted.getId()).getGrnType());assertEquals("Updated note",posted.getNotes());
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void grnHttpCreatePostsInventory() throws Exception {
  String body="""
    {"supplierId":%d,"grnType":"Standard Inward","receivedDate":"2026-10-09",
     "items":[{"productId":%d,"quantityReceived":3,"unitCost":6.66666667}]}
    """.formatted(supplier.getId(),product.getId());
  mvc.perform(post("/api/v1/grns?process=true").contentType("application/json").content(body))
    .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PROCESSED"));
  assertEquals(0,n("103").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void grnHttpAllowsFreeReceiptsAndRejectsNegativeCost() throws Exception {
  String body="""
    {"supplierId":%d,"receivedDate":"2026-10-09",
     "items":[{"productId":%d,"quantityReceived":2,"unitCost":0}]}
    """.formatted(supplier.getId(),product.getId());
  mvc.perform(post("/api/v1/grns?process=true").contentType("application/json").content(body))
    .andExpect(status().isCreated()).andExpect(jsonPath("$.data.totalAmount").value(0));
  assertEquals(0,n("102").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  mvc.perform(post("/api/v1/grns?process=true").contentType("application/json").content(body.replace("\"unitCost\":0", "\"unitCost\":-1")))
    .andExpect(status().isBadRequest());
 }
 @Test void automaticGrnRejectsMissingProductWarehouse() {
  product.setDefaultWarehouse(null);products.save(product);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.createGrn(automaticReceiptRequest(),true));
 }
 @Test void automaticGrnRejectsInactiveWarehouse() {
  warehouse.setIsActive(false);warehouses.save(warehouse);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.createGrn(automaticReceiptRequest(),true));
 }
 @Test void automaticGrnPostsAndCancelsMixedWarehousesUsingOriginalDestinations() {
  var otherWarehouse=warehouses.save(Warehouse.builder().code("OTHER-W").name("Other warehouse").build());
  var other=products.save(Product.builder().sku("OTHER-P").name("Other product").category(product.getCategory()).defaultWarehouse(otherWarehouse).sellingPrice(n("10")).costPrice(n("4")).build());
  var req=automaticReceiptRequest();var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(other.getId());line.setQuantityReceived(n("1"));line.setUnitCost(n("4"));req.setItems(List.of(req.getItems().getFirst(),line));
  var receipt=grns.createGrn(req,true);
  assertEquals(2,receipt.getItems().size());
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,n("1").compareTo(stock.getAvailableStock(otherWarehouse.getId(),other.getId())));
  assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(warehouse.getId(),other.getId())));
  assertTrue(grns.searchGrns(otherWarehouse.getId(),null,null,null,org.springframework.data.domain.Pageable.ofSize(20)).getContent().stream().anyMatch(g -> g.getId().equals(receipt.getId())));
  other.setDefaultWarehouse(warehouse);products.save(other);
  grns.cancelGrn(receipt.getId(),"Reverse mixed receipt");
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(otherWarehouse.getId(),other.getId())));
 }
 @Test void draftGrnUpdateAllowsMixedDestinationsAndProcessingUsesSavedDestinations() {
  var otherWarehouse=warehouses.save(Warehouse.builder().code("DRAFT-W").name("Draft destination").build());
  var other=products.save(Product.builder().sku("DRAFT-P").name("Draft product").category(product.getCategory()).defaultWarehouse(otherWarehouse).sellingPrice(n("10")).costPrice(n("4")).build());
  var req=automaticReceiptRequest();var draft=grns.createGrn(req,false);
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(other.getId());line.setQuantityReceived(n("3"));line.setUnitCost(n("4"));
  req.setItems(List.of(req.getItems().getFirst(),line));
  var updated=grns.updateGrn(draft.getId(),req,false);
  assertEquals(2,updated.getItems().size());
  other.setDefaultWarehouse(warehouse);products.save(other);
  grns.processGrn(draft.getId());
  assertEquals(0,n("3").compareTo(stock.getAvailableStock(otherWarehouse.getId(),other.getId())));
  assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(warehouse.getId(),other.getId())));
 }
 @Test void purchaseReturnUsesMatchingLineDestinationFromMixedReceipt() {
  var otherWarehouse=warehouses.save(Warehouse.builder().code("RETURN-W").name("Return destination").build());
  var other=products.save(Product.builder().sku("RETURN-P").name("Return product").category(product.getCategory()).defaultWarehouse(otherWarehouse).sellingPrice(n("10")).costPrice(n("4")).build());
  var req=automaticReceiptRequest();var received=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();received.setProductId(other.getId());received.setQuantityReceived(n("3"));received.setUnitCost(n("4"));
  req.setItems(List.of(req.getItems().getFirst(),received));var receipt=grns.createGrn(req,true);
  var returnReq=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();returnReq.setSupplierId(supplier.getId());returnReq.setWarehouseId(otherWarehouse.getId());returnReq.setSourceGrnId(receipt.getId());returnReq.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(other.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("99"));returnReq.setItems(List.of(line));
  purchaseReturns.createPurchaseReturn(returnReq,true);
  assertEquals(0,n("1").compareTo(stock.getAvailableStock(otherWarehouse.getId(),other.getId())));
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void automaticGrnRejectsWarehouseOverride() {
  var req=automaticReceiptRequest();req.setWarehouseId(-1L);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.createGrn(req,true));
 }
 @Test void automaticGrnRejectsInvalidType() {
  var req=automaticReceiptRequest();req.setGrnType("Unknown type");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.createGrn(req,false));
 }
 @Test void brandMarkupCalculatesReceiptSellingPriceAndManualDraftEditPersists() {
  var brandReq=new com.nbh.erp.brand.dto.CreateBrandRequest();brandReq.setCode("MP-BRAND");brandReq.setName("Markup brand");brandReq.setMarkupPercent(n("25"));
  var brand=brandService.createBrand(brandReq);
  product.setBrand(brands.findById(brand.getId()).orElseThrow());products.save(product);
  assertEquals(0,n("25").compareTo(com.nbh.erp.product.dto.ProductDto.from(product,true).getBrandMarkupPercent()));
  var req=automaticReceiptRequest();var line=req.getItems().getFirst();line.setUseBrandMarkup(true);line.setSellingPrice(n("999"));
  var draft=grns.createGrn(req,false);var saved=draft.getItems().getFirst();
  assertEquals(0,n("5.00").compareTo(saved.getSellingPrice()));assertEquals(0,n("25").compareTo(saved.getMarkupPercent()));assertTrue(saved.getUseBrandMarkup());
  line.setUseBrandMarkup(false);line.setSellingPrice(n("7.25"));line.setMarkupPercent(n("25"));
  var edited=grns.updateGrn(draft.getId(),req,false);
  assertEquals(0,n("7.25").compareTo(edited.getItems().getFirst().getSellingPrice()));assertFalse(edited.getItems().getFirst().getUseBrandMarkup());
  assertEquals(0,n("81.25").compareTo(edited.getItems().getFirst().getMarkupPercent()));
  line.setSellingPrice(n("3.00"));line.setMarkupPercent(n("-25"));
  var belowCost=grns.updateGrn(draft.getId(),req,false);
  assertEquals(0,n("-25").compareTo(belowCost.getItems().getFirst().getMarkupPercent()));
  line.setSellingPrice(n("7.25"));line.setMarkupPercent(n("81.25"));grns.updateGrn(draft.getId(),req,false);
  assertEquals(0,n("7.25").compareTo(grns.getGrnById(draft.getId()).getItems().getFirst().getSellingPrice()));
  var update=new com.nbh.erp.brand.dto.UpdateBrandRequest();update.setName("Markup brand");update.setMarkupPercent(n("30"));brandService.updateBrand(brand.getId(),update);
  assertEquals(0,n("30").compareTo(brandService.getBrandById(brand.getId()).getMarkupPercent()));
 }
 com.nbh.erp.grn.dto.GrnDto receipt() {
  var req=new com.nbh.erp.grn.dto.CreateGrnRequest();req.setSupplierId(supplier.getId());req.setWarehouseId(warehouse.getId());req.setReceivedDate(LocalDate.now());
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(product.getId());line.setQuantityReceived(n("5"));line.setUnitCost(n("4"));req.setItems(List.of(line));
  return grns.createGrn(req,true);
 }
 @Test void supplierPaymentCannotExceedOutstanding() {
  var grn=receipt();supplierPayments.pay(grn.getId(),n("15"),"BANK_TRANSFER");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->supplierPayments.pay(grn.getId(),n("6"),"BANK_TRANSFER"));
 }
 @Test void supplierPaymentReversalRestoresPayable() {
  var grn=receipt();var payment=supplierPayments.pay(grn.getId(),n("15"),"BANK_TRANSFER");supplierPayments.reverse(payment.id(),"Correction");
  assertEquals(0,n("20").compareTo(supplierPayments.outstanding().stream().filter(r->r.id().equals(grn.getId())).findFirst().orElseThrow().balance()));
 }
 @Test void supplierReturnUsesOriginalReceiptCost() {
  var grn=receipt();product.setCostPrice(n("9"));products.save(product);
  var req=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();req.setSupplierId(supplier.getId());req.setWarehouseId(warehouse.getId());req.setSourceGrnId(grn.getId());req.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("99"));req.setItems(List.of(line));
  var result=purchaseReturns.createPurchaseReturn(req,true);assertEquals(0,n("8").compareTo(result.getTotalAmount()));
  assertEquals(0,n("12").compareTo(supplierPayments.outstanding().stream().filter(r->r.id().equals(grn.getId())).findFirst().orElseThrow().balance()));
 }

 @Test void prnMixedSuppliersAndWarehousesKeepReceiptCostsAndReverseEveryLine() throws Exception {
  var first=receipt();
  var otherSupplier=suppliers.save(Supplier.builder().supplierCode("PRN-S2").name("Second return supplier").isActive(true).build());
  var otherWarehouse=warehouses.save(Warehouse.builder().code("PRN-W2").name("Second stocked warehouse").isActive(true).build());
  product.setDefaultWarehouse(otherWarehouse);products.save(product);
  var receiptRequest=automaticReceiptRequest();receiptRequest.setSupplierId(otherSupplier.getId());receiptRequest.getItems().getFirst().setUnitCost(n("7"));
  var second=grns.createGrn(receiptRequest,true);
  product.setCostPrice(n("99"));product.setDefaultWarehouse(warehouse);products.save(product);
  var sources=purchaseReturns.getReturnSources();
  var source=sources.stream().filter(row->row.sourceGrnId().equals(second.getId())).findFirst().orElseThrow();
  assertEquals(second.getGrnNumber(),source.originalGrnNumber());assertEquals(otherWarehouse.getId(),source.warehouseId());assertEquals(otherSupplier.getId(),source.supplierId());assertEquals(0,n("7").compareTo(source.costPrice()));
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var firstLine=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();firstLine.setProductId(product.getId());firstLine.setSourceGrnId(first.getId());firstLine.setWarehouseId(warehouse.getId());firstLine.setQuantityReturned(n("2"));firstLine.setUnitCost(n("99"));firstLine.setReason("Damage");firstLine.setRemarks("First box torn");
  var secondLine=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();secondLine.setProductId(product.getId());secondLine.setSourceGrnId(second.getId());secondLine.setWarehouseId(otherWarehouse.getId());secondLine.setQuantityReturned(n("3"));secondLine.setUnitCost(n("99"));secondLine.setReason("Wrong specification");secondLine.setRemarks("Second supplier note");request.setItems(List.of(firstLine,secondLine));
  var draft=purchaseReturns.createPurchaseReturn(request,false);
  assertNull(draft.getSupplierId());assertNull(draft.getWarehouseId());assertNull(draft.getSourceGrnId());assertEquals(2,draft.getItems().size());
  assertEquals(0,n("4").compareTo(draft.getItems().getFirst().getUnitCost()));assertEquals(0,n("7").compareTo(draft.getItems().get(1).getUnitCost()));assertEquals("Second supplier note",draft.getItems().get(1).getRemarks());
  firstLine.setQuantityReturned(n("1"));var edited=purchaseReturns.updatePurchaseReturn(draft.getId(),request,false);assertEquals(draft.getId(),edited.getId());assertEquals(0,n("1").compareTo(edited.getItems().getFirst().getQuantityReturned()));
  var processed=purchaseReturns.processPurchaseReturn(draft.getId());assertEquals(0,n("25").compareTo(processed.getTotalAmount()));
  assertEquals(0,n("104").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("2").compareTo(stock.getAvailableStock(otherWarehouse.getId(),product.getId())));
  var repo=context.getBean(com.nbh.erp.purchasereturn.repository.PurchaseReturnRepository.class);assertEquals(0,n("4").compareTo(repo.totalReturned(first.getId())));assertEquals(0,n("21").compareTo(repo.totalReturned(second.getId())));
  assertTrue(purchaseReturns.searchPurchaseReturns(otherWarehouse.getId(),otherSupplier.getId(),null,null,org.springframework.data.domain.PageRequest.of(0,20)).getContent().stream().anyMatch(row->row.getId().equals(draft.getId())));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.cancelGrn(second.getId(),"Correction"));
  assertEquals("CANCELLED",purchaseReturns.cancelPurchaseReturn(draft.getId()).getStatus());assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("5").compareTo(stock.getAvailableStock(otherWarehouse.getId(),product.getId())));
  stock.decreaseStock(otherWarehouse.getId(),product.getId(),n("4"),"TEST","USED","Used stock");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.processPurchaseReturn(draft.getId()));assertEquals("CANCELLED",purchaseReturns.getPurchaseReturnById(draft.getId()).getStatus());assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  mvc.perform(get("/api/v1/purchase-returns/return-sources")).andExpect(status().isOk());
 }

 @Test void prnAdjustedStockUsesProductPurchaseHistoryAndCurrentWarehouse() {
  var grn=receipt();
  var adjusted=warehouses.save(Warehouse.builder().code("PRN-ADJ-W").name("Adjusted stock warehouse").isActive(true).build());
  stock.increaseStock(adjusted.getId(),product.getId(),n("10"),n("99"),"ADJUSTMENT","ADJ-1","Opening adjustment");
  var source=purchaseReturns.getReturnSources().stream().filter(row->row.sourceGrnId().equals(grn.getId()) && row.warehouseId().equals(adjusted.getId())).findFirst().orElseThrow();
  assertEquals(grn.getGrnNumber(),source.originalGrnNumber());assertEquals(supplier.getId(),source.supplierId());
  assertEquals(0,n("4").compareTo(source.costPrice()));assertEquals(0,n("5").compareTo(source.returnableQuantity()));
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setSourceGrnId(grn.getId());line.setWarehouseId(adjusted.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("99"));request.setItems(List.of(line));
  var prn=purchaseReturns.createPurchaseReturn(request,true);
  assertEquals(0,n("8").compareTo(prn.getTotalAmount()));assertEquals(0,n("8").compareTo(stock.getAvailableStock(adjusted.getId(),product.getId())));
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  line.setQuantityReturned(n("3"));purchaseReturns.updatePurchaseReturn(prn.getId(),request,false);
  assertEquals(0,n("7").compareTo(stock.getAvailableStock(adjusted.getId(),product.getId())));
  purchaseReturns.cancelPurchaseReturn(prn.getId());assertEquals(0,n("10").compareTo(stock.getAvailableStock(adjusted.getId(),product.getId())));
 }
 @Test void prnPurchaseQuantityIsSharedAcrossAllStockedWarehouses() {
  var grn=receipt();var other=warehouses.save(Warehouse.builder().code("PRN-CAP-W").name("Other adjusted warehouse").isActive(true).build());
  stock.increaseStock(other.getId(),product.getId(),n("10"),n("4"),"ADJUSTMENT","ADJ-2","Adjustment");
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var lines=new ArrayList<com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest>();
  for(var wh:List.of(warehouse,other)) {var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setSourceGrnId(grn.getId());line.setWarehouseId(wh.getId());line.setQuantityReturned(n("3"));lines.add(line);}
  request.setItems(lines);var draft=purchaseReturns.createPurchaseReturn(request,false);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.processPurchaseReturn(draft.getId()));
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("10").compareTo(stock.getAvailableStock(other.getId(),product.getId())));
  lines.getLast().setQuantityReturned(n("2"));purchaseReturns.updatePurchaseReturn(draft.getId(),request,false);purchaseReturns.processPurchaseReturn(draft.getId());
  assertTrue(purchaseReturns.getReturnSources().stream().noneMatch(row->row.sourceGrnId().equals(grn.getId())));
 }
 @Test void prnAdjustmentWithoutAnyProductPurchaseCannotUseAnotherProductsGrn() {
  var grn=receipt();
  var neverBought=products.save(Product.builder().sku("PRN-NEVER").name("Adjustment only product").category(product.getCategory()).defaultWarehouse(warehouse).costPrice(n("4")).sellingPrice(n("10")).isActive(true).build());
  stock.increaseStock(warehouse.getId(),neverBought.getId(),n("10"),n("4"),"ADJUSTMENT","ADJ-3","Adjustment only");
  assertTrue(purchaseReturns.getReturnSources().stream().noneMatch(row->row.productId().equals(neverBought.getId())));
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(neverBought.getId());line.setSourceGrnId(grn.getId());line.setWarehouseId(warehouse.getId());line.setQuantityReturned(n("1"));request.setItems(List.of(line));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.createPurchaseReturn(request,true));
  assertEquals(0,n("10").compareTo(stock.getAvailableStock(warehouse.getId(),neverBought.getId())));
 }

 @Test void prnMultipleReceiptsCannotOverdrawTheSameWarehouseStock() {
  var first=receipt();var second=receipt();
  stock.decreaseStock(warehouse.getId(),product.getId(),n("107"),"TEST","USED","Leave only three units");
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var lines=new ArrayList<com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest>();
  for(var receipt:List.of(first,second)) { var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setSourceGrnId(receipt.getId());line.setWarehouseId(warehouse.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("4"));lines.add(line); }
  request.setItems(lines);var draft=purchaseReturns.createPurchaseReturn(request,false);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.processPurchaseReturn(draft.getId()));assertEquals("DRAFT",purchaseReturns.getPurchaseReturnById(draft.getId()).getStatus());assertEquals(0,n("3").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }

 @Test void prnProcessedEditsPreserveStatusAndCheckAdditionalStockBeforeChangingAnything() {
  var grn=receipt();var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setSourceGrnId(grn.getId());line.setWarehouseId(warehouse.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("99"));line.setReason("Damaged");request.setItems(List.of(line));
  var prn=purchaseReturns.createPurchaseReturn(request,true);line.setQuantityReturned(n("3"));
  var increased=purchaseReturns.updatePurchaseReturn(prn.getId(),request,false);assertEquals("PROCESSED",increased.getStatus());assertEquals(0,n("102").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("12").compareTo(increased.getTotalAmount()));
  stock.decreaseStock(warehouse.getId(),product.getId(),n("101"),"TEST","USED","Leave one available unit");line.setQuantityReturned(n("5"));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.updatePurchaseReturn(prn.getId(),request,true));
  assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals("PROCESSED",purchaseReturns.getPurchaseReturnById(prn.getId()).getStatus());assertEquals(0,n("3").compareTo(purchaseReturns.getPurchaseReturnById(prn.getId()).getItems().getFirst().getQuantityReturned()));
  line.setQuantityReturned(n("1"));var decreased=purchaseReturns.updatePurchaseReturn(prn.getId(),request,false);assertEquals("PROCESSED",decreased.getStatus());assertEquals(0,n("3").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,n("16").compareTo(supplierPayments.outstanding().stream().filter(row->row.id().equals(grn.getId())).findFirst().orElseThrow().balance()));
  purchaseReturns.cancelPurchaseReturn(prn.getId());assertEquals(0,n("4").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.updatePurchaseReturn(prn.getId(),request,false));assertEquals("CANCELLED",purchaseReturns.getPurchaseReturnById(prn.getId()).getStatus());
 }

 @Test void purchasingStatusReasonsAreRequiredAndRecordedWithActorAndTransition() throws Exception {
  mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).defaultRequest(get("/").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(SecurityContextHolder.getContext().getAuthentication()))).build();
  var draftGrn=grns.createGrn(automaticReceiptRequest(),false);var original=receipt();
  var request=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();request.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setSourceGrnId(original.getId());line.setWarehouseId(warehouse.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("4"));request.setItems(List.of(line));
  var prn=purchaseReturns.createPurchaseReturn(request,false);
  var po=orders.save(null,new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),null,null,null,"DRAFT",List.of(new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4")))));
  var destination=warehouses.save(Warehouse.builder().code("REASON-W").name("Reason destination").isActive(true).build());
  var transferRequest=new com.nbh.erp.gtn.dto.CreateGtnRequest();transferRequest.setResponsibleStaffId(admin.getId());transferRequest.setStatus("DRAFT");
  var transferLine=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();transferLine.setProductId(product.getId());transferLine.setSourceWarehouseId(warehouse.getId());transferLine.setDestinationWarehouseId(destination.getId());transferLine.setQuantityTransferred(n("1"));transferRequest.setItems(List.of(transferLine));
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);var gtn=transfers.createGtn(transferRequest,false);
  var audit=context.getBean(com.nbh.erp.audit.repository.AuditLogRepository.class);long initialLogs=audit.count();
  for(String url:List.of("/api/v1/grns/"+draftGrn.getId()+"/process","/api/v1/purchase-returns/"+prn.getId()+"/process","/api/v1/purchase-returns/"+prn.getId()+"/cancel")) {
   mvc.perform(post(url).contentType("application/json").content("{\"reason\":\"   \"}")).andExpect(status().isBadRequest());
  }
  mvc.perform(post("/api/v1/purchase-orders/"+po.id()+"/status").contentType("application/json").content("{\"status\":\"INFORM_TO_ORDER\",\"reason\":\" \"}")).andExpect(status().isBadRequest());
  mvc.perform(patch("/api/v1/suppliers/"+supplier.getId()+"/toggle-active").contentType("application/json").content("{\"reason\":\"\"}")).andExpect(status().isBadRequest());
  mvc.perform(post("/api/v1/gtns/"+gtn.getId()+"/status").contentType("application/json").content("{\"status\":\"PENDING\",\"reason\":\"\"}")).andExpect(status().isBadRequest());
  assertEquals(initialLogs,audit.count());assertTrue(suppliers.findById(supplier.getId()).orElseThrow().getIsActive());assertEquals("DRAFT",grns.getGrnById(draftGrn.getId()).getStatus());assertEquals("DRAFT",purchaseReturns.getPurchaseReturnById(prn.getId()).getStatus());assertEquals("DRAFT",orders.get(po.id()).status());assertEquals("DRAFT",transfers.getGtnById(gtn.getId()).getStatus());
  mvc.perform(post("/api/v1/grns/"+draftGrn.getId()+"/process").contentType("application/json").content("{\"reason\":\"Receipt confirmed by office\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/purchase-returns/"+prn.getId()+"/process").contentType("application/json").content("{\"reason\":\"Supplier return approved\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/purchase-orders/"+po.id()+"/status").contentType("application/json").content("{\"status\":\"INFORM_TO_ORDER\",\"reason\":\"Order prepared for handover\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/gtns/"+gtn.getId()+"/status").contentType("application/json").content("{\"status\":\"PENDING\",\"reason\":\"Transfer dispatched with driver\"}")).andExpect(status().isOk());
  mvc.perform(patch("/api/v1/suppliers/"+supplier.getId()+"/toggle-active").contentType("application/json").content("{\"reason\":\"Supplier disabled for review\"}")).andExpect(status().isOk());
  for(String reason:List.of("Receipt confirmed by office","Supplier return approved","Order prepared for handover","Transfer dispatched with driver","Supplier disabled for review")) {
   var entry=audit.findAll().stream().filter(record->record.getDetails().contains(reason)).findFirst().orElseThrow();assertEquals("PURCHASING",entry.getModule());assertEquals("regression-admin",entry.getUsername());assertTrue(entry.getDetails().contains(" -> "));assertNotNull(entry.getCreatedAt());
  }
  mvc.perform(post("/api/v1/purchase-returns/"+prn.getId()+"/cancel").contentType("application/json").content("{\"reason\":\"Return entered against wrong receipt\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/grns/"+original.getId()+"/cancel").contentType("application/json").content("{\"reason\":\"Incorrect supplier delivery\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/purchase-orders/"+po.id()+"/status").contentType("application/json").content("{\"status\":\"DRAFT\",\"reason\":\"Supplier cannot deliver\"}")).andExpect(status().isOk());
  mvc.perform(post("/api/v1/purchase-orders/"+po.id()+"/status").contentType("application/json").content("{\"status\":\"INFORM_TO_ORDER\",\"reason\":\"Supplier confirmed new delivery\"}")).andExpect(status().isOk());
  assertEquals("CANCELLED",purchaseReturns.getPurchaseReturnById(prn.getId()).getStatus());assertTrue(audit.findAll().stream().anyMatch(record->record.getDetails().equals("PROCESSED -> CANCELLED: Return entered against wrong receipt")));
 }

 @Test void warehouseCheckpointsDoNotPostStockUntilCompletion() {
  var invoice=invoices.createInvoice(sale(true));var update=new UpdateInvoiceRequest();update.setStatus("SENT_TO_WAREHOUSE");invoices.updateInvoice(invoice.getId(),update);
  update.setStatus("STOCK_ADJUSTED");invoices.updateInvoice(invoice.getId(),update);
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertTrue(invoices.getHeldInvoices(null).stream().anyMatch(i->i.getId().equals(invoice.getId())));
  invoices.completeHeldInvoices(List.of(invoice.getId()));
  assertEquals(0,n("98").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,n("20").compareTo(customers.findById(customer.getId()).orElseThrow().getCurrentBalance()));
 }

 @Test void grnCancellationRestoresOriginalStock() {
  var grn=receipt();product.setCostPrice(n("9"));products.save(product);grns.cancelGrn(grn.getId(),"Incorrect receipt");
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void processedGrnEditsPostOnlyQuantityDifferencesAndCanBeCancelledAgain() {
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);
  req.getItems().getFirst().setQuantityReceived(n("8"));
  assertEquals("PROCESSED",grns.updateGrn(grn.getId(),req,true).getStatus());
  assertEquals(0,n("108").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  req.getItems().getFirst().setQuantityReceived(n("6"));
  assertEquals("PROCESSED",grns.updateGrn(grn.getId(),req,false).getStatus());
  assertEquals(0,n("106").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  grns.updateGrn(grn.getId(),req,true);
  assertEquals(0,n("106").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  grns.cancelGrn(grn.getId(),"Correct receipt");
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  var restored=grns.processGrn(grn.getId());assertEquals("PROCESSED",restored.getStatus());assertNull(restored.getCancelReason());
  assertEquals(0,n("106").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.processGrn(grn.getId()));
  grns.cancelGrn(grn.getId(),"Cancel restored receipt");
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void processedGrnReductionRequiresOnlyTheDifferenceInAvailableStock() {
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);
  stock.decreaseStock(warehouse.getId(),product.getId(),n("102"),"TEST","USED","Used stock");
  req.getItems().getFirst().setQuantityReceived(n("3"));
  grns.updateGrn(grn.getId(),req,true);
  assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void processedGrnEditAndCancellationRejectInsufficientInventoryWithoutChangingReceipt() {
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);
  stock.decreaseStock(warehouse.getId(),product.getId(),n("104"),"TEST","USED","Used stock");
  req.getItems().getFirst().setQuantityReceived(n("2"));
  var failure=assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.updateGrn(grn.getId(),req,true));
  assertTrue(failure.getMessage().contains("insufficient inventory"));
  var cancelFailure=assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.cancelGrn(grn.getId(),"Insufficient stock"));
  assertTrue(cancelFailure.getMessage().contains("available stock is 1"));
  assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals("PROCESSED",grns.getGrnById(grn.getId()).getStatus());
  assertEquals(0,n("5").compareTo(grns.getGrnById(grn.getId()).getItems().getFirst().getQuantityReceived()));
 }
 @Test void processedGrnRemovalChecksOriginalWarehouseAndNewProductsIncreaseTheirOwnStock() {
  var otherWarehouse=warehouses.save(Warehouse.builder().code("EDIT-W").name("Edit destination").build());
  var other=products.save(Product.builder().sku("EDIT-P").name("Edit product").category(product.getCategory()).defaultWarehouse(otherWarehouse).sellingPrice(n("10")).costPrice(n("4")).build());
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);
  product.setDefaultWarehouse(otherWarehouse);products.save(product);
  var added=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();added.setProductId(other.getId());added.setQuantityReceived(n("2"));added.setUnitCost(n("4"));
  req.setItems(List.of(req.getItems().getFirst(),added));grns.updateGrn(grn.getId(),req,true);
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(otherWarehouse.getId(),product.getId())));
  assertEquals(0,n("2").compareTo(stock.getAvailableStock(otherWarehouse.getId(),other.getId())));
  req.setItems(List.of(added));grns.updateGrn(grn.getId(),req,true);
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void cancelledGrnEditDoesNotPostStockUntilReprocessed() {
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);grns.cancelGrn(grn.getId(),"Correction");
  req.getItems().getFirst().setQuantityReceived(n("9"));
  assertEquals("CANCELLED",grns.updateGrn(grn.getId(),req,false).getStatus());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals("PROCESSED",grns.processGrn(grn.getId()).getStatus());
  assertEquals(0,n("109").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void processedGrnEditPreservesPaymentAndReturnSafeguards() {
  var req=automaticReceiptRequest();var grn=grns.createGrn(req,true);supplierPayments.pay(grn.getId(),n("5"),"BANK_TRANSFER");
  req.getItems().getFirst().setQuantityReceived(n("3"));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->grns.updateGrn(grn.getId(),req,true));
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void gtnCancellationAndReprocessingReverseStockSafely() throws Exception {
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);
  var destination=warehouses.save(Warehouse.builder().code("REG-DEST").name("Destination").isActive(true).build());
  var req=new com.nbh.erp.gtn.dto.CreateGtnRequest();req.setSourceWarehouseId(warehouse.getId());req.setDestinationWarehouseId(destination.getId());
  var line=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();line.setProductId(product.getId());line.setQuantityTransferred(n("5"));req.setItems(List.of(line));
  req.setResponsibleStaffId(admin.getId());
  var draft=transfers.createGtn(req,false);assertEquals("DRAFT",draft.getStatus());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  req.setStatus("PENDING");req.setStatusReason("Ready for dispatch");var pendingUpdated=transfers.updateGtn(draft.getId(),req);assertEquals(draft.getId(),pendingUpdated.getId());
  assertEquals("PENDING",pendingUpdated.getStatus());assertEquals(admin.getId(),pendingUpdated.getResponsibleStaffId());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  var pending=transfers.createGtn(req,true);assertEquals("PENDING",pending.getStatus());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  var pdf=context.getBean(com.nbh.erp.pdf.service.PdfGenerationService.class).generateGtnPdf(pendingUpdated.getId());
  var reader=new com.lowagie.text.pdf.PdfReader(pdf);var text=new com.lowagie.text.pdf.parser.PdfTextExtractor(reader).getTextFromPage(1).replaceAll("\\s+", " ");
  assertTrue(text.contains("Responsible staff: Regression"));assertTrue(text.contains("Accepted by destination warehouse"));assertTrue(text.contains("Signature:"));reader.close();
  var gtn=transfers.transferGtn(pendingUpdated.getId());
  assertEquals("TRANSFERRED",gtn.getStatus());assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  stock.decreaseStock(destination.getId(),product.getId(),n("1"),"TEST","USED","Consumed stock");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.cancelGtn(gtn.getId()));
  assertEquals("TRANSFERRED",transfers.getGtnById(gtn.getId()).getStatus());assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  stock.increaseStock(destination.getId(),product.getId(),n("1"),n("4"),"TEST","RESTORE","Restore stock");
  assertEquals("CANCELLED",transfers.cancelGtn(gtn.getId()).getStatus());transfers.cancelGtn(gtn.getId());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
  assertEquals("PENDING",transfers.dispatchGtn(gtn.getId(),admin.getId()).getStatus());
  assertEquals("TRANSFERRED",transfers.transferGtn(gtn.getId()).getStatus());
  assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.transferGtn(gtn.getId()));
  assertEquals(0,n("5").compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
 }
 @Test void prnCancellationRestoresStockAndSupplierPayableAndCanReprocess() {
  var grn=receipt();
  var req=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest();req.setSupplierId(supplier.getId());req.setWarehouseId(warehouse.getId());req.setSourceGrnId(grn.getId());req.setReturnDate(LocalDate.now());
  var line=new com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest();line.setProductId(product.getId());line.setQuantityReturned(n("2"));line.setUnitCost(n("4"));req.setItems(List.of(line));
  var prn=purchaseReturns.createPurchaseReturn(req,true);
  assertEquals(0,n("103").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals("CANCELLED",purchaseReturns.cancelPurchaseReturn(prn.getId()).getStatus());purchaseReturns.cancelPurchaseReturn(prn.getId());
  assertEquals(0,n("105").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals(0,n("20").compareTo(supplierPayments.outstanding().stream().filter(r->r.id().equals(grn.getId())).findFirst().orElseThrow().balance()));
  assertEquals("PROCESSED",purchaseReturns.processPurchaseReturn(prn.getId()).getStatus());
  assertEquals(0,n("103").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  purchaseReturns.cancelPurchaseReturn(prn.getId());
  stock.decreaseStock(warehouse.getId(),product.getId(),n("104"),"TEST","USED","Consume stock");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->purchaseReturns.processPurchaseReturn(prn.getId()));
  assertEquals("CANCELLED",purchaseReturns.getPurchaseReturnById(prn.getId()).getStatus());assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void purchaseOrdersDraftInformAndCancelledSupportSafeEdits() {
  var draft=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),null,null,null,"DRAFT",List.of(new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4"))));
  var po=orders.save(null,draft);assertEquals("DRAFT",po.status());
  assertEquals("DRAFT",orders.save(po.id(),draft).status());
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(product.getId(),n("1")),false));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.transition(po.id(),"APPROVED","Invalid old approval status"));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.transition(po.id(),"INFORM_TO_ORDER"," "));
  assertEquals("INFORM_TO_ORDER",orders.transition(po.id(),"INFORM_TO_ORDER","Ready to print and hand over").status());
  var informed=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),null,null,"Updated order","INFORM_TO_ORDER",List.of(new PurchaseOrderRequest.Line(product.getId(),n("6"),n("4"))));
  assertEquals("INFORM_TO_ORDER",orders.save(po.id(),informed).status());
  assertEquals("CANCELLED",orders.transition(po.id(),"CANCELLED","Order no longer needed").status());
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.save(po.id(),informed));
  assertEquals("DRAFT",orders.transition(po.id(),"DRAFT","Correct cancelled order").status());
  orders.transition(po.id(),"INFORM_TO_ORDER","Corrected order ready");orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(product.getId(),n("2")),false);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.transition(po.id(),"DRAFT","Edit received order"));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.transition(po.id(),"CANCELLED","Cancel received order"));
  var reduced=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),null,null,null,"INFORM_TO_ORDER",List.of(new PurchaseOrderRequest.Line(product.getId(),n("1"),n("4"))));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->orders.save(po.id(),reduced));
  assertEquals("INFORM_TO_ORDER",orders.save(po.id(),informed).status());
  assertEquals(0,n("2").compareTo(orders.get(po.id()).items().get(0).receivedQuantity()));
  orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(product.getId(),n("2")),true);
  assertEquals("CANCELLED",orders.transition(po.id(),"CANCELLED","Receipt reversed; cancel the order").status());
  assertEquals("INFORM_TO_ORDER",orders.transition(po.id(),"INFORM_TO_ORDER","Order required again").status());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void gtnResponsibleStaffSearchIncludesAllStaff() {
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);
  var worker=users.save(User.builder().username("handover-worker").email("worker@test.local").fullName("Warehouse worker").employeeCode("STAFF-22").phone("0771234567").roles(new HashSet<>(admin.getRoles())).password("test-password").isActive(false).approvalStatus("PENDING").build());
  var staffList=transfers.getResponsibleStaff();
  assertTrue(staffList.stream().anyMatch(member -> member.id().equals(admin.getId())));
  var member=staffList.stream().filter(entry -> entry.id().equals(worker.getId())).findFirst().orElseThrow();
  assertEquals("STAFF-22",member.employeeCode());assertEquals("handover-worker",member.username());
  assertEquals("0771234567",member.phone());assertTrue(member.roles().contains("ROLE_ADMIN"));
  var destination=warehouses.save(Warehouse.builder().code("REG-STAFF-DEST").name("Staff destination").isActive(true).build());
  var req=new com.nbh.erp.gtn.dto.CreateGtnRequest();req.setSourceWarehouseId(warehouse.getId());req.setDestinationWarehouseId(destination.getId());req.setResponsibleStaffId(worker.getId());
  var line=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();line.setProductId(product.getId());line.setQuantityTransferred(n("2"));req.setItems(List.of(line));
  var gtn=transfers.createGtn(req,true);assertEquals("PENDING",gtn.getStatus());assertEquals(worker.getId(),gtn.getResponsibleStaffId());
 }
 @Test void gtnStatusCorrectionsRequireReasonsAndReverseInventorySafely() {
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);
  var destination=warehouses.save(Warehouse.builder().code("REG-STATUS-DEST").name("Status destination").isActive(true).build());
  var req=new com.nbh.erp.gtn.dto.CreateGtnRequest();req.setSourceWarehouseId(warehouse.getId());req.setDestinationWarehouseId(destination.getId());req.setResponsibleStaffId(admin.getId());
  var line=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();line.setProductId(product.getId());line.setQuantityTransferred(n("5"));req.setItems(List.of(line));
  var gtn=transfers.createGtn(req,true);
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.changeStatus(gtn.getId(),"TRANSFERRED"," ",true));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.changeStatus(gtn.getId(),"TRANSFERRED","Signed copy",false));
  var done=transfers.changeStatus(gtn.getId(),"TRANSFERRED","Signed copy received",true);assertEquals("Signed copy received",done.getLastStatusReason());
  assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertEquals("PENDING",transfers.changeStatus(gtn.getId(),"PENDING","Office correction",false).getStatus());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,BigDecimal.ZERO.compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
  transfers.changeStatus(gtn.getId(),"CANCELLED","Incorrect paperwork",false);
  assertEquals("TRANSFERRED",transfers.changeStatus(gtn.getId(),"TRANSFERRED","Cancellation was incorrect",true).getStatus());
  stock.decreaseStock(destination.getId(),product.getId(),n("1"),"TEST","USED","Consumed stock");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.changeStatus(gtn.getId(),"PENDING","Correct the record",false));
  assertEquals("TRANSFERRED",transfers.getGtnById(gtn.getId()).getStatus());assertEquals("Cancellation was incorrect",transfers.getGtnById(gtn.getId()).getLastStatusReason());
  assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  stock.increaseStock(destination.getId(),product.getId(),n("1"),n("4"),"TEST","RESTORE","Restored stock");
  transfers.changeStatus(gtn.getId(),"CANCELLED","Cancel transfer",false);
  assertEquals("PENDING",transfers.changeStatus(gtn.getId(),"PENDING","Reschedule handover",false).getStatus());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void transferredGtnEditsAdjustOnlyStockDifferencesAndCanChangeStaff() {
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);
  var destination=warehouses.save(Warehouse.builder().code("REG-EDIT-DEST").name("Edit destination").isActive(true).build());
  var req=new com.nbh.erp.gtn.dto.CreateGtnRequest();req.setSourceWarehouseId(warehouse.getId());req.setDestinationWarehouseId(destination.getId());req.setResponsibleStaffId(admin.getId());
  var line=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();line.setProductId(product.getId());line.setQuantityTransferred(n("5"));req.setItems(List.of(line));
  var pending=transfers.createGtn(req,true);var done=transfers.changeStatus(pending.getId(),"TRANSFERRED","Received and signed",true);
  req.setStatus("TRANSFERRED");line.setQuantityTransferred(n("7"));var edited=transfers.updateGtn(done.getId(),req);
  assertEquals("TRANSFERRED",edited.getStatus());assertEquals(done.getReceiveDate(),edited.getReceiveDate());
  assertEquals(0,n("93").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("7").compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
  stock.decreaseStock(destination.getId(),product.getId(),n("6"),"TEST","USED","Consume stock");
  var worker=users.save(User.builder().username("gtn-edit-worker").email("gtn-edit@test.local").fullName("New responsible worker").password("test-password").build());
  req.setResponsibleStaffId(worker.getId());req.setNotes("Corrected staff and remarks");edited=transfers.updateGtn(done.getId(),req);
  assertEquals(worker.getId(),edited.getResponsibleStaffId());assertEquals(0,n("1").compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
  line.setQuantityTransferred(n("5"));assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.updateGtn(done.getId(),req));
  assertEquals(0,n("93").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("1").compareTo(stock.getAvailableStock(destination.getId(),product.getId())));
 }
 @Test void mixedWarehouseGtnPrintsPerSourceAndMovesOriginalLineRoutes() throws Exception {
  var transfers=context.getBean(com.nbh.erp.gtn.service.GtnService.class);
  var sourceB=warehouses.save(Warehouse.builder().code("REG-SRC-B").name("Source B").isActive(true).build());
  var sourceC=warehouses.save(Warehouse.builder().code("REG-SRC-C").name("Source C").isActive(true).build());
  var destinationX=warehouses.save(Warehouse.builder().code("REG-DST-X").name("Destination X").isActive(true).build());
  var destinationY=warehouses.save(Warehouse.builder().code("REG-DST-Y").name("Destination Y").isActive(true).build());
  var productB=products.save(Product.builder().sku("MIX-B").name("Mixed product B").category(product.getCategory()).defaultWarehouse(sourceB).sellingPrice(n("10")).costPrice(n("4")).isActive(true).build());
  var productC=products.save(Product.builder().sku("MIX-C").name("Mixed product C").category(product.getCategory()).defaultWarehouse(sourceC).sellingPrice(n("10")).costPrice(n("4")).isActive(true).build());
  stock.increaseStock(sourceB.getId(),productB.getId(),n("20"),n("4"),"TEST","OPEN-B","Opening stock");stock.increaseStock(sourceC.getId(),productC.getId(),n("20"),n("4"),"TEST","OPEN-C","Opening stock");
  var lines=new ArrayList<com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest>();
  for(var route:new long[][]{{product.getId(),warehouse.getId(),destinationX.getId(),3},{productB.getId(),sourceB.getId(),destinationY.getId(),4},{productC.getId(),sourceC.getId(),destinationY.getId(),5},{product.getId(),warehouse.getId(),destinationY.getId(),2}}) {
   var line=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();line.setProductId(route[0]);line.setSourceWarehouseId(route[1]);line.setDestinationWarehouseId(route[2]);line.setQuantityTransferred(BigDecimal.valueOf(route[3]));lines.add(line);
  }
  var req=new com.nbh.erp.gtn.dto.CreateGtnRequest();req.setResponsibleStaffId(admin.getId());req.setItems(lines);
  var gtn=transfers.createGtn(req,true);assertEquals("PENDING",gtn.getStatus());assertNull(gtn.getSourceWarehouseId());assertNull(gtn.getDestinationWarehouseId());assertEquals(4,gtn.getItems().size());
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  productB.setDefaultWarehouse(warehouse);products.save(productB);
  var pdf=context.getBean(com.nbh.erp.pdf.service.PdfGenerationService.class).generateGtnPdf(gtn.getId());var reader=new com.lowagie.text.pdf.PdfReader(pdf);assertEquals(3,reader.getNumberOfPages());
  var extractor=new com.lowagie.text.pdf.parser.PdfTextExtractor(reader);
  String first=extractor.getTextFromPage(1).replaceAll("\\s+"," "),second=extractor.getTextFromPage(2).replaceAll("\\s+"," "),third=extractor.getTextFromPage(3).replaceAll("\\s+"," ");
  assertTrue(first.contains(product.getSku()));assertFalse(first.contains("MIX-B"));assertFalse(first.contains("MIX-C"));assertTrue(first.contains("Destination X"));assertTrue(first.contains("Destination Y"));
  assertTrue(second.contains("MIX-B"));assertFalse(second.contains("MIX-C"));assertTrue(third.contains("MIX-C"));assertFalse(third.contains("MIX-B"));
  for(String page:List.of(first,second,third)) { assertTrue(page.contains(gtn.getGtnNumber()));assertTrue(page.contains("Responsible staff: Regression"));assertTrue(page.contains("Signature:")); }
  reader.close();
  assertEquals(1,transfers.searchGtns(sourceC.getId(),null,null,null,org.springframework.data.domain.PageRequest.of(0,20)).getContent().size());
  transfers.changeStatus(gtn.getId(),"TRANSFERRED","All source copies returned signed",true);
  assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("16").compareTo(stock.getAvailableStock(sourceB.getId(),productB.getId())));assertEquals(0,n("15").compareTo(stock.getAvailableStock(sourceC.getId(),productC.getId())));
  assertEquals(0,n("3").compareTo(stock.getAvailableStock(destinationX.getId(),product.getId())));assertEquals(0,n("2").compareTo(stock.getAvailableStock(destinationY.getId(),product.getId())));
  stock.decreaseStock(destinationY.getId(),productC.getId(),n("1"),"TEST","USED","Consumed destination stock");
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->transfers.changeStatus(gtn.getId(),"PENDING","Warehouse correction",false));
  assertEquals("TRANSFERRED",transfers.getGtnById(gtn.getId()).getStatus());assertEquals(0,n("95").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("16").compareTo(stock.getAvailableStock(sourceB.getId(),productB.getId())));
  stock.increaseStock(destinationY.getId(),productC.getId(),n("1"),n("4"),"TEST","RESTORE","Restore stock");
  transfers.changeStatus(gtn.getId(),"PENDING","Reschedule all routes",false);
  assertEquals(0,n("100").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));assertEquals(0,n("20").compareTo(stock.getAvailableStock(sourceB.getId(),productB.getId())));assertEquals(0,n("20").compareTo(stock.getAvailableStock(sourceC.getId(),productC.getId())));
  var twoSource=new com.nbh.erp.gtn.dto.CreateGtnRequest();twoSource.setResponsibleStaffId(admin.getId());twoSource.setItems(lines.subList(0,2));var another=transfers.createGtn(twoSource,true);
  var twoPages=new com.lowagie.text.pdf.PdfReader(context.getBean(com.nbh.erp.pdf.service.PdfGenerationService.class).generateGtnPdf(another.getId()));assertEquals(2,twoPages.getNumberOfPages());twoPages.close();
  var tenLines=new ArrayList<>(lines);
  for(int extra=0;extra<6;extra++) {
   var extraDestination=warehouses.save(Warehouse.builder().code("EXTRA-DST-"+extra).name("Extra destination "+extra).isActive(true).build());
   var extraProduct=products.save(Product.builder().sku("EXTRA-P-"+extra).name("Extra mixed product "+extra).category(product.getCategory()).defaultWarehouse(warehouse).costPrice(n("4")).sellingPrice(n("10")).isActive(true).build());
   var extraLine=new com.nbh.erp.gtn.dto.CreateGtnRequest.CreateGtnItemRequest();extraLine.setProductId(extraProduct.getId());extraLine.setSourceWarehouseId(warehouse.getId());extraLine.setDestinationWarehouseId(extraDestination.getId());extraLine.setQuantityTransferred(n("1"));tenLines.add(extraLine);
  }
  var tenRequest=new com.nbh.erp.gtn.dto.CreateGtnRequest();tenRequest.setResponsibleStaffId(admin.getId());tenRequest.setItems(tenLines);var tenDocument=transfers.createGtn(tenRequest,true);
  var tenPdf=new com.lowagie.text.pdf.PdfReader(context.getBean(com.nbh.erp.pdf.service.PdfGenerationService.class).generateGtnPdf(tenDocument.getId()));assertEquals(3,tenPdf.getNumberOfPages(),"Ten mixed-route lines from three source warehouses print as three source sheets");tenPdf.close();

 }
}
