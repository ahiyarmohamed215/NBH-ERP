package com.nbh.erp;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class PurchasingInventoryInputValidationTest {
 private final Validator validator=Validation.buildDefaultValidatorFactory().getValidator();
 private void invalid(Object request,String field){assertFalse(validator.validateProperty(request,field).isEmpty(),field+" must be rejected");}
 private void valid(Object request,String field){assertTrue(validator.validateProperty(request,field).isEmpty(),field+" must be accepted");}
 @Test void productFieldsRespectStorageAndNumberTypes(){
  var r=new com.nbh.erp.product.dto.CreateProductRequest();r.setMinStockLevel(-1);invalid(r,"minStockLevel");r.setMinStockLevel(0);valid(r,"minStockLevel");
  r.setSku("x".repeat(51));invalid(r,"sku");r.setCategoryId(-1L);invalid(r,"categoryId");
  r.setDescription("x".repeat(5001));invalid(r,"description");r.setSellingPrice(new BigDecimal("1.234"));invalid(r,"sellingPrice");
 }
 @Test void brandMarkupHasFourDecimalPlacesAndTextLimit(){
  var r=new com.nbh.erp.brand.dto.CreateBrandRequest();r.setMarkupPercent(new BigDecimal("12.34567"));invalid(r,"markupPercent");
  r.setMarkupPercent(new BigDecimal("12.3456"));valid(r,"markupPercent");r.setDescription("x".repeat(5001));invalid(r,"description");
  var edit=new com.nbh.erp.brand.dto.UpdateBrandRequest();edit.setMarkupPercent(new BigDecimal("-1"));invalid(edit,"markupPercent");
  var category=new com.nbh.erp.category.dto.CreateCategoryRequest();category.setDescription("x".repeat(5001));invalid(category,"description");
 }
 @Test void warehousePhoneAndTextAreValidated(){
  var r=new com.nbh.erp.warehouse.dto.CreateWarehouseRequest();r.setPhone("abc");invalid(r,"phone");r.setPhone("+94771234567");valid(r,"phone");
  r.setAddress("x".repeat(5001));invalid(r,"address");r.setContactPerson("x".repeat(101));invalid(r,"contactPerson");
 }
 @Test void allocationBoundsApplyToCreationAndEditing(){
  var create=new com.nbh.erp.inventory.dto.CreateProductStaffQuotaRequest();create.setAllocatedQuantity(new BigDecimal("2.001"));invalid(create,"allocatedQuantity");
  create.setAllocatedQuantity(new BigDecimal("9999999999.99"));valid(create,"allocatedQuantity");create.setUserId(0L);invalid(create,"userId");
  var edit=new com.nbh.erp.inventory.dto.UpdateProductStaffQuotaRequest();edit.setAllocatedQuantity(new BigDecimal("10000000000"));invalid(edit,"allocatedQuantity");
 }
 @Test void adjustmentsRejectInvalidQuantitiesAndLongReasons(){
  var r=new com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest();r.setWarehouseId(0L);invalid(r,"warehouseId");r.setReason("x".repeat(5001));invalid(r,"reason");
  var item=new com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest.CreateStockAdjustmentItemRequest();item.setPhysicalQuantity(new BigDecimal("-1"));invalid(item,"physicalQuantity");item.setReason("x".repeat(256));invalid(item,"reason");
 }
}
