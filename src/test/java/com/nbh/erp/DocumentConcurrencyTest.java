package com.nbh.erp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DocumentConcurrencyTest {
 @Autowired com.nbh.erp.grn.service.GrnService grns;
 @Autowired com.nbh.erp.warehouse.repository.WarehouseRepository warehouses;
 @Autowired com.nbh.erp.supplier.repository.SupplierRepository suppliers;
 @Autowired com.nbh.erp.category.repository.CategoryRepository categories;
 @Autowired com.nbh.erp.product.repository.ProductRepository products;
 @Autowired com.nbh.erp.inventory.service.StockService stock;
 @Test void concurrentProcessingPostsInventoryOnlyOnce() throws Exception {
  String key=UUID.randomUUID().toString().substring(0,8);
  var warehouse=warehouses.save(com.nbh.erp.warehouse.entity.Warehouse.builder().code(key).name("Concurrent warehouse").isActive(true).build());
  var supplier=suppliers.save(com.nbh.erp.supplier.entity.Supplier.builder().supplierCode(key).name("Concurrent supplier").isActive(true).build());
  var category=categories.save(com.nbh.erp.category.entity.Category.builder().code(key).name("Concurrent category").build());
  var product=products.save(com.nbh.erp.product.entity.Product.builder().sku(key).name("Concurrent product").category(category).sellingPrice(BigDecimal.TEN).costPrice(BigDecimal.ONE).isActive(true).build());
  var request=new com.nbh.erp.grn.dto.CreateGrnRequest();request.setSupplierId(supplier.getId());request.setWarehouseId(warehouse.getId());request.setReceivedDate(LocalDate.now());
  var line=new com.nbh.erp.grn.dto.CreateGrnRequest.CreateGrnItemRequest();line.setProductId(product.getId());line.setQuantityReceived(BigDecimal.TEN);line.setUnitCost(BigDecimal.ONE);request.setItems(List.of(line));
  var receipt=grns.createGrn(request,false);
  var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
  Callable<Boolean> action=()->{ready.countDown();assertTrue(start.await(10,TimeUnit.SECONDS));try{grns.processGrn(receipt.getId());return true;}catch(com.nbh.erp.common.exception.BusinessException expected){return false;}};
  try(var executor=Executors.newFixedThreadPool(2)) {
   var first=executor.submit(action);var second=executor.submit(action);assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();
   assertNotEquals(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS));
  }
  assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
}
