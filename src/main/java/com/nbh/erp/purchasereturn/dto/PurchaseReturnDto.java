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
    private List<PurchaseReturnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static PurchaseReturnDto from(PurchaseReturn prn) {
        return PurchaseReturnDto.builder()
                .id(prn.getId())
                .prnNumber(prn.getPrnNumber())
                .supplierId(prn.getSupplier().getId())
                .supplierCode(prn.getSupplier().getSupplierCode())
                .supplierName(prn.getSupplier().getName())
                .warehouseId(prn.getWarehouse().getId())
                .warehouseCode(prn.getWarehouse().getCode())
                .warehouseName(prn.getWarehouse().getName())
                .status(prn.getStatus())
                .totalAmount(prn.getTotalAmount())
                .returnDate(prn.getReturnDate())
                .reason(prn.getReason())
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
        private BigDecimal totalCost;
        private String reason;

        public static PurchaseReturnItemDto from(PurchaseReturnItem item) {
            return PurchaseReturnItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .quantityReturned(item.getQuantityReturned())
                    .unitCost(item.getUnitCost())
                    .totalCost(item.getTotalCost())
                    .reason(item.getReason())
                    .build();
        }
    }
}
