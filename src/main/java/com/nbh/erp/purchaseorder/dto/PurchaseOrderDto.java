package com.nbh.erp.purchaseorder.dto;
import com.nbh.erp.purchaseorder.entity.PurchaseOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record PurchaseOrderDto(Long id,String poNumber,Long supplierId,String supplierName,Long warehouseId,String warehouseName,
 LocalDate orderDate,LocalDate expectedDate,String terms,String notes,String status,BigDecimal totalAmount,List<Line> items,java.time.LocalDateTime createdAt) {
 public record Line(Long productId,String productName,String sku,BigDecimal quantity,BigDecimal receivedQuantity,BigDecimal unitCost,BigDecimal sellingPrice,BigDecimal totalCost,Long warehouseId,String warehouseName,Long supplierId,String supplierName) {}
 public static PurchaseOrderDto from(PurchaseOrder p) {
  return new PurchaseOrderDto(p.getId(),p.getPoNumber(),p.getItems().stream().map(i->i.getOrderingSupplier().getId()).distinct().count()<=1?p.getSupplier().getId():null,
   p.getItems().stream().map(i->i.getOrderingSupplier().getDisplayName()).distinct().collect(java.util.stream.Collectors.joining(", ")),p.getItems().stream().map(i->i.getDeliveryWarehouse().getId()).distinct().count()<=1?p.getWarehouse().getId():null,
   p.getItems().stream().map(i->i.getDeliveryWarehouse().getName()).distinct().collect(java.util.stream.Collectors.joining(", ")),
   p.getOrderDate(),p.getExpectedDate(),p.getTerms(),p.getNotes(),p.getStatus(),p.getTotalAmount(),p.getItems().stream().map(i -> new Line(i.getProduct().getId(),i.getProduct().getName(),i.getProduct().getSku(),i.getQuantity(),i.getReceivedQuantity(),i.getUnitCost(),i.getProduct().getSellingPrice(),i.getQuantity().multiply(i.getUnitCost()),i.getDeliveryWarehouse().getId(),i.getDeliveryWarehouse().getName(),i.getOrderingSupplier().getId(),i.getOrderingSupplier().getDisplayName())).toList(),p.getCreatedAt());
 }
}
