package com.nbh.erp.purchaseorder.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record PurchaseOrderRequest(Long supplierId,Long warehouseId,LocalDate orderDate,
 LocalDate expectedDate,String terms,String notes,String status,@NotEmpty List<@Valid Line> items,String statusReason) {
 public PurchaseOrderRequest(Long supplierId,Long warehouseId,LocalDate orderDate,LocalDate expectedDate,String terms,String notes,String status,List<Line> items) {
  this(supplierId,warehouseId,orderDate,expectedDate,terms,notes,status,items,null);
 }
 public record Line(@NotNull Long productId,@NotNull @Positive BigDecimal quantity,@NotNull @PositiveOrZero BigDecimal unitCost,Long warehouseId,Long supplierId) {
  public Line(Long productId,BigDecimal quantity,BigDecimal unitCost,Long warehouseId) { this(productId,quantity,unitCost,warehouseId,null); }
  public Line(Long productId,BigDecimal quantity,BigDecimal unitCost) { this(productId,quantity,unitCost,null,null); }
 }
}
