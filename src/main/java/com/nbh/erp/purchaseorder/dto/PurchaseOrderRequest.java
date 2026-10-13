package com.nbh.erp.purchaseorder.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record PurchaseOrderRequest(@Positive Long supplierId,@Positive Long warehouseId,LocalDate orderDate,
 LocalDate expectedDate,@Size(max=255) String terms,@Size(max=5000) String notes,String status,@NotEmpty List<@Valid Line> items,@Size(max=1000) String statusReason) {
 public PurchaseOrderRequest(Long supplierId,Long warehouseId,LocalDate orderDate,LocalDate expectedDate,String terms,String notes,String status,List<Line> items) {
  this(supplierId,warehouseId,orderDate,expectedDate,terms,notes,status,items,null);
 }
 public record Line(@NotNull @Positive Long productId,@NotNull @Positive @Digits(integer=12,fraction=3) BigDecimal quantity,@NotNull @PositiveOrZero @Digits(integer=13,fraction=2) BigDecimal unitCost,@Positive Long warehouseId,@Positive Long supplierId) {
  public Line(Long productId,BigDecimal quantity,BigDecimal unitCost,Long warehouseId) { this(productId,quantity,unitCost,warehouseId,null); }
  public Line(Long productId,BigDecimal quantity,BigDecimal unitCost) { this(productId,quantity,unitCost,null,null); }
 }
}
