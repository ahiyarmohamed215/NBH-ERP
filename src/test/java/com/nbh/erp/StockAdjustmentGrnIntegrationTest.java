package com.nbh.erp;

import com.nbh.erp.stockadjustment.service.StockAdjustmentService;
import com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.grn.entity.*;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.exception.BusinessException;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StockAdjustmentGrnIntegrationTest {
 @Autowired StockAdjustmentService adjustments;
 @Autowired StockService stock;
 @Autowired GrnRepository grns;
 @Autowired ProductRepository products;
 @Autowired WarehouseRepository warehouses;
 @Autowired SupplierRepository suppliers;
 @Autowired CategoryRepository categories;
 @Autowired com.nbh.erp.grn.service.GrnService grnService;
 Product product;Warehouse warehouse;Supplier supplier;
 static BigDecimal n(String value){return new BigDecimal(value);}
 @BeforeEach void setup(){
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("adjustment-test",null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
  String key=UUID.randomUUID().toString().substring(0,8);
  warehouse=warehouses.save(Warehouse.builder().code(key).name("Adjustment warehouse").isActive(true).build());
  supplier=suppliers.save(Supplier.builder().supplierCode(key).name("Adjustment supplier").isActive(true).build());
  var category=categories.save(Category.builder().code(key).name("Adjustment category").build());
  product=products.save(Product.builder().sku(key).name("Adjustment product "+key).category(category).defaultWarehouse(warehouse).costPrice(n("4")).sellingPrice(n("10")).isActive(true).build());
 }
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 Grn receipt(Product product,LocalDate date,String status){
  var grn=Grn.builder().grnNumber("GRN-ADJ-"+UUID.randomUUID().toString().substring(0,8)).supplier(supplier).warehouse(warehouse).receivedDate(date).status(status).items(new ArrayList<>()).build();
  grn.getItems().add(GrnItem.builder().grn(grn).product(product).warehouse(null).quantityReceived(n("10")).unitCost(n("4")).totalCost(n("40")).build());
  return grns.saveAndFlush(grn);
 }
 CreateStockAdjustmentRequest request(String mode,String qty){
  var request=new CreateStockAdjustmentRequest();request.setWarehouseId(warehouse.getId());request.setAdjustmentDate(LocalDate.now());request.setAdjustmentType(mode);request.setReason("Count verified");
  var line=new CreateStockAdjustmentRequest.CreateStockAdjustmentItemRequest();line.setProductId(product.getId());line.setQuantity(n(qty));request.setItems(List.of(line));return request;
 }
 @Test void zeroStockAdditionFindsTheLatestMatchingReceiptEvenBehindOtherProducts(){
  var old=receipt(product,LocalDate.now().minusDays(2),"PROCESSED");
  var latest=receipt(product,LocalDate.now().minusDays(1),"PROCESSED");
  receipt(product,LocalDate.now(),"CANCELLED");
  var other=products.save(Product.builder().sku(UUID.randomUUID().toString()).name("Other product").category(product.getCategory()).isActive(true).build());receipt(other,LocalDate.now(),"PROCESSED");
  var choices=adjustments.searchProducts(product.getSku());assertEquals(1,choices.size());assertEquals(0,choices.getFirst().availableStock().signum());assertEquals(latest.getId(),choices.getFirst().sourceGrnId());
  var result=adjustments.createAdjustment(request("ADDITION","2.5"),true);assertEquals(latest.getId(),result.getItems().getFirst().getSourceGrnId());assertNotEquals(old.getId(),result.getItems().getFirst().getSourceGrnId());
  assertEquals(0,n("2.5").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(BusinessException.class,()->grnService.cancelGrn(latest.getId(),"Cannot remove linked receipt"));
 }
 @Test void reductionsPreserveHeldBillReservations(){
  receipt(product,LocalDate.now(),"PROCESSED");stock.increaseStock(warehouse.getId(),product.getId(),n("10"),n("4"),"GRN","OPEN","Opening");stock.changeReservation(warehouse.getId(),product.getId(),n("7"));
  adjustments.createAdjustment(request("REDUCTION","2"),true);assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  assertThrows(BusinessException.class,()->adjustments.createAdjustment(request("REDUCTION","2"),true));assertEquals(0,n("1").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void processingUsesTheDeltaAgainstCurrentStockInsteadOfAnOldBrowserTotal(){
  receipt(product,LocalDate.now(),"PROCESSED");stock.increaseStock(warehouse.getId(),product.getId(),n("10"),n("4"),"GRN","OPEN","Opening");
  var draft=adjustments.createAdjustment(request("ADDITION","2"),false);
  stock.decreaseStock(warehouse.getId(),product.getId(),n("3"),"SALE","OTHER","Other staff sale");
  var result=adjustments.processAdjustment(draft.getId());assertEquals(0,n("9").compareTo(result.getItems().getFirst().getPhysicalQuantity()));assertEquals(0,n("7").compareTo(result.getItems().getFirst().getSystemQuantity()));
  assertThrows(BusinessException.class,()->adjustments.processAdjustment(draft.getId()));
 }
 @Test void noReceiptOrWrongWarehouseCannotCreateUnlinkedAdjustments(){
  assertThrows(BusinessException.class,()->adjustments.createAdjustment(request("ADDITION","1"),true));
  receipt(product,LocalDate.now(),"DRAFT");assertThrows(BusinessException.class,()->adjustments.createAdjustment(request("ADDITION","1"),true));
  var receipt=receipt(product,LocalDate.now(),"PROCESSED");
  var other=warehouses.save(Warehouse.builder().code(UUID.randomUUID().toString().substring(0,8)).name("Other warehouse").isActive(true).build());
  var wrong=request("ADDITION","1");wrong.setWarehouseId(other.getId());assertThrows(BusinessException.class,()->adjustments.createAdjustment(wrong,true));
 }
 @Test void draftCanBeEditedAndCancelledWithoutMovingStock(){
  receipt(product,LocalDate.now(),"PROCESSED");
  var draft=adjustments.createAdjustment(request("ADDITION","2"),false);
  var edited=adjustments.updateDraft(draft.getId(),request("ADDITION","5"),false);
  assertEquals(draft.getAdjustmentNumber(),edited.getAdjustmentNumber());
  assertEquals(0,n("5").compareTo(edited.getItems().getFirst().getDifferenceQuantity()));
  assertEquals(0,stock.getAvailableStock(warehouse.getId(),product.getId()).signum());
  assertEquals("CANCELLED",adjustments.cancelAdjustment(draft.getId(),"Duplicate count").getStatus());
  assertThrows(BusinessException.class,()->adjustments.processAdjustment(draft.getId()));
  assertThrows(BusinessException.class,()->adjustments.updateDraft(draft.getId(),request("ADDITION","3"),false));
 }
 @Test void cancellationReversesBothTypesOnceAndProtectsReservedStock(){
  receipt(product,LocalDate.now(),"PROCESSED");
  var addition=adjustments.createAdjustment(request("ADDITION","10"),true);
  stock.changeReservation(warehouse.getId(),product.getId(),n("7"));
  assertThrows(BusinessException.class,()->adjustments.cancelAdjustment(addition.getId(),"Wrong count"));
  assertEquals("PROCESSED",adjustments.getAdjustmentById(addition.getId()).getStatus());
  stock.changeReservation(warehouse.getId(),product.getId(),n("-7"));
  adjustments.cancelAdjustment(addition.getId(),"Wrong count");
  assertEquals(0,stock.getAvailableStock(warehouse.getId(),product.getId()).signum());
  assertThrows(BusinessException.class,()->adjustments.cancelAdjustment(addition.getId(),"Retry"));
  stock.increaseStock(warehouse.getId(),product.getId(),n("10"),n("4"),"GRN","OPEN","Opening");
  var reduction=adjustments.createAdjustment(request("REDUCTION","3"),true);
  adjustments.cancelAdjustment(reduction.getId(),"Wrong reduction");
  assertEquals(0,n("10").compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }

}
