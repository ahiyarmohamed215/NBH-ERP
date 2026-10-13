package com.nbh.erp.purchasereturn.dto;

import com.nbh.erp.purchasereturn.entity.PurchaseReturn;
import com.nbh.erp.purchasereturn.entity.PurchaseReturnItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseReturnDto {
    private Long id;
    private String prnNumber;
    private Long sourceGrnId;
    private String originalGrnNumber;
    private Long supplierId;
    private String supplierCode;
    private String supplierName;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private String status;
    private BigDecimal totalAmount;
    private LocalDate returnDate;
    private String reason;
    private String remarks;
    private List<PurchaseReturnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static PurchaseReturnDto from(PurchaseReturn prn) {
        return PurchaseReturnDto.builder()
                .id(prn.getId())
                .prnNumber(prn.getPrnNumber())
                .sourceGrnId(prn.getItems().stream().map(PurchaseReturnItem::getOriginalGrnId).distinct().count() == 1 ? prn.getItems().getFirst().getOriginalGrnId() : null)
                .originalGrnNumber(prn.getItems().stream().filter(item -> item.getSourceGrn() != null).map(item -> item.getSourceGrn().getGrnNumber()).distinct().collect(Collectors.joining(", ")))
                .supplierId(prn.getItems().stream().map(item -> item.getReturnSupplier().getId()).distinct().count() <= 1 ? prn.getSupplier().getId() : null)
                .supplierCode(prn.getItems().stream().map(item -> item.getReturnSupplier().getId()).distinct().count() <= 1 ? prn.getSupplier().getSupplierCode() : null)
                .supplierName(prn.getItems().stream().map(item -> item.getReturnSupplier().getName()).distinct().collect(Collectors.joining(", ")))
                .warehouseId(prn.getItems().stream().map(item -> item.getReturnWarehouse().getId()).distinct().count() <= 1 ? prn.getWarehouse().getId() : null)
                .warehouseCode(prn.getItems().stream().map(item -> item.getReturnWarehouse().getId()).distinct().count() <= 1 ? prn.getWarehouse().getCode() : null)
                .warehouseName(prn.getItems().stream().map(item -> item.getReturnWarehouse().getName()).distinct().collect(Collectors.joining(", ")))
                .status(prn.getStatus())
                .totalAmount(prn.getTotalAmount())
                .returnDate(prn.getReturnDate())
                .reason(prn.getReason() != null ? prn.getReason() : prn.getItems().stream().map(PurchaseReturnItem::getReason).filter(java.util.Objects::nonNull).distinct().collect(Collectors.joining(", ")))
                .remarks(prn.getRemarks() != null ? prn.getRemarks() : prn.getItems().stream().map(PurchaseReturnItem::getRemarks).filter(java.util.Objects::nonNull).filter(value -> !value.isBlank()).distinct().collect(Collectors.joining("; ")))
                .createdBy(prn.getCreatedBy())
                .createdAt(prn.getCreatedAt())
                .items(prn.getItems() != null
                        ? prn.getItems().stream().map(PurchaseReturnItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PurchaseReturnItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productName;
        private String unitOfMeasure;
        private BigDecimal quantityReturned;
        private BigDecimal unitCost;
        private BigDecimal sellingPrice;
        private BigDecimal totalCost;
        private String reason;
        private String remarks;
        private Long sourceGrnId;
        private String originalGrnNumber;
        private Long supplierId;
        private String supplierName;
        private Long warehouseId;
        private String warehouseName;

        public static PurchaseReturnItemDto from(PurchaseReturnItem item) {
            return PurchaseReturnItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .quantityReturned(item.getQuantityReturned())
                    .unitCost(item.getUnitCost())
                    .sellingPrice(item.getProduct().getSellingPrice())
                    .totalCost(item.getTotalCost())
                    .reason(item.getReason())
                    .remarks(item.getRemarks())
                    .sourceGrnId(item.getOriginalGrnId())
                    .originalGrnNumber(item.getSourceGrn() != null ? item.getSourceGrn().getGrnNumber() : null)
                    .supplierId(item.getReturnSupplier().getId()).supplierName(item.getReturnSupplier().getName())
                    .warehouseId(item.getReturnWarehouse().getId()).warehouseName(item.getReturnWarehouse().getName())
                    .build();
        }
    }
}
