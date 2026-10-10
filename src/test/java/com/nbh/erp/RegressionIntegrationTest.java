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
 @Test void purchaseOrdersPersistAndTrackPartialReceipts() { var req=new PurchaseOrderRequest(supplier.getId(),warehouse.getId(),LocalDate.now(),LocalDate.now().plusDays(1),"Cash","Test","APPROVED",List.of(new PurchaseOrderRequest.Line(product.getId(),n("5"),n("4"))));var po=orders.save(null,req);orders.receive(po.id(),supplier.getId(),warehouse.getId(),Map.of(product.getId(),n("2")),false);assertEquals("PARTIAL",orders.get(po.id()).status());assertEquals(0,n("2").compareTo(orders.get(po.id()).items().get(0).receivedQuantity())); }
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
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(product.getId());line.setQuantityReceived(n("5"));line.setUnitCost(n("4"));req.setItems(List.of(line));
  return req;
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
}
