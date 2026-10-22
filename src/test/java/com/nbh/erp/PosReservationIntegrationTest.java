package com.nbh.erp;

import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.service.InvoiceService;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PosReservationIntegrationTest {
 @Autowired InvoiceService invoices;
 @Autowired StockService stock;
 @Autowired CustomerRepository customers;
 @Autowired WarehouseRepository warehouses;
 @Autowired ProductRepository products;
 @Autowired CategoryRepository categories;
 record Fixture(Long customer,Long warehouse,Long product) {}
 Fixture fixture(){
  String key=UUID.randomUUID().toString().substring(0,8);
  var customer=customers.save(com.nbh.erp.customer.entity.Customer.builder().customerCode(key).name("POS customer").creditLimit(BigDecimal.valueOf(1000)).currentBalance(BigDecimal.ZERO).isActive(true).build());
  var warehouse=warehouses.save(com.nbh.erp.warehouse.entity.Warehouse.builder().code(key).name("POS warehouse").isActive(true).build());
  var category=categories.save(com.nbh.erp.category.entity.Category.builder().code(key).name("POS category").build());
  var product=products.save(com.nbh.erp.product.entity.Product.builder().sku(key).name("POS product").category(category).defaultWarehouse(warehouse).sellingPrice(BigDecimal.TEN).costPrice(BigDecimal.ONE).isActive(true).build());
  stock.increaseStock(warehouse.getId(),product.getId(),BigDecimal.TEN,BigDecimal.ONE,"GRN",key,"POS test opening");
  return new Fixture(customer.getId(),warehouse.getId(),product.getId());
 }
 CreateInvoiceRequest request(Fixture f,int qty){return CreateInvoiceRequest.builder().customerId(f.customer()).warehouseId(f.warehouse()).hold(true).reserveStock(true).items(List.of(CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(f.product()).quantity(BigDecimal.valueOf(qty)).unitPrice(BigDecimal.TEN).build())).build();}
 void available(Fixture f,int qty){assertEquals(0,BigDecimal.valueOf(qty).compareTo(stock.getAvailableStock(f.warehouse(),f.product())));}
 @Test void editsCancelAndCheckoutKeepAvailabilityAccurate(){
  var f=fixture();var bill=invoices.createInvoice(request(f,3));available(f,7);
  var edit=request(f,5);edit.setExpectedVersion(bill.getRecordVersion());var updated=invoices.savePosDraft(bill.getId(),edit);available(f,5);
  assertThrows(BusinessException.class,()->invoices.savePosDraft(bill.getId(),edit));available(f,5);
  invoices.cancelHeldInvoice(updated.getId());available(f,10);
  var second=invoices.createInvoice(request(f,4));var customer=customers.findById(f.customer()).orElseThrow();customer.setCreditLimit(BigDecimal.ZERO);customers.saveAndFlush(customer);var checkout=request(f,4);checkout.setHold(false);checkout.setExpectedVersion(second.getRecordVersion());
  assertThrows(BusinessException.class,()->invoices.resumeHeldInvoice(second.getId(),checkout));available(f,6);
  assertThrows(BusinessException.class,()->invoices.resumeHeldInvoice(second.getId(),checkout));available(f,6);
 }
 @Test void concurrentBillsCannotReserveTheSameStock() throws Exception {
  var f=fixture();var other=customers.save(com.nbh.erp.customer.entity.Customer.builder().customerCode(UUID.randomUUID().toString().substring(0,8)).name("Second POS customer").creditLimit(BigDecimal.valueOf(1000)).currentBalance(BigDecimal.ZERO).isActive(true).build());
  var ready=new CountDownLatch(2);var start=new CountDownLatch(1);var sequence=new java.util.concurrent.atomic.AtomicInteger();
  Callable<Boolean> action=()->{ready.countDown();assertTrue(start.await(10,TimeUnit.SECONDS));try{var bill=request(f,7);if(sequence.getAndIncrement()>0)bill.setCustomerId(other.getId());invoices.createInvoice(bill);return true;}catch(BusinessException expected){return false;}};
  try(var executor=Executors.newFixedThreadPool(2)){
   var a=executor.submit(action);var b=executor.submit(action);assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();assertNotEquals(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));
  }
  available(f,3);
 }
 @Test void failedEditRollsBackTheOriginalReservation(){
  var f=fixture();var bill=invoices.createInvoice(request(f,3));
  assertThrows(BusinessException.class,()->invoices.savePosDraft(bill.getId(),request(f,11)));available(f,7);
  invoices.cancelHeldInvoice(bill.getId());available(f,10);
 }
}
