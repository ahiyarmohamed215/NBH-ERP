package com.nbh.erp.purchaseorder.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record PurchaseOrderRequest(@NotNull Long supplierId,@NotNull Long warehouseId,@NotNull LocalDate orderDate,
 LocalDate expectedDate,String terms,String notes,String status,@NotEmpty List<@Valid Line> items) {
 public record Line(@NotNull Long productId,@NotNull @Positive BigDecimal quantity,@NotNull @PositiveOrZero BigDecimal unitCost) {}
}
