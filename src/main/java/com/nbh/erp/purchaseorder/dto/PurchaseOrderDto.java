package com.nbh.erp.purchaseorder.dto;
import com.nbh.erp.purchaseorder.entity.PurchaseOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record PurchaseOrderDto(Long id,String poNumber,Long supplierId,String supplierName,Long warehouseId,String warehouseName,
 LocalDate orderDate,LocalDate expectedDate,String terms,String notes,String status,BigDecimal totalAmount,List<Line> items) {
 public record Line(Long productId,String productName,String sku,BigDecimal quantity,BigDecimal receivedQuantity,BigDecimal unitCost,BigDecimal totalCost) {}
 public static PurchaseOrderDto from(PurchaseOrder p) {
  return new PurchaseOrderDto(p.getId(),p.getPoNumber(),p.getSupplier().getId(),p.getSupplier().getName(),p.getWarehouse().getId(),p.getWarehouse().getName(),
   p.getOrderDate(),p.getExpectedDate(),p.getTerms(),p.getNotes(),p.getStatus(),p.getTotalAmount(),p.getItems().stream().map(i -> new Line(i.getProduct().getId(),i.getProduct().getName(),i.getProduct().getSku(),i.getQuantity(),i.getReceivedQuantity(),i.getUnitCost(),i.getQuantity().multiply(i.getUnitCost()))).toList());
 }
}
