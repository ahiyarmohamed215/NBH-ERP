package com.nbh.erp.grn.dto;

import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
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
public class GrnDto {
    private Long id;
    private String grnNumber;
    private Long supplierId;
    private String supplierCode;
    private String supplierName;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private String supplierInvoiceNumber;
    private String status;
    private BigDecimal totalAmount;
    private LocalDate receivedDate;
    private String notes;
    private List<GrnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static GrnDto from(Grn grn) {
        return GrnDto.builder()
                .id(grn.getId())
                .grnNumber(grn.getGrnNumber())
                .supplierId(grn.getSupplier().getId())
                .supplierCode(grn.getSupplier().getSupplierCode())
                .supplierName(grn.getSupplier().getName())
                .warehouseId(grn.getWarehouse().getId())
                .warehouseCode(grn.getWarehouse().getCode())
                .warehouseName(grn.getWarehouse().getName())
                .supplierInvoiceNumber(grn.getSupplierInvoiceNumber())
                .status(grn.getStatus())
                .totalAmount(grn.getTotalAmount())
                .receivedDate(grn.getReceivedDate())
                .notes(grn.getNotes())
                .createdBy(grn.getCreatedBy())
                .createdAt(grn.getCreatedAt())
                .items(grn.getItems() != null
                        ? grn.getItems().stream().map(GrnItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GrnItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productBarcode;
        private String productName;
        private String unitOfMeasure;
        private BigDecimal quantityReceived;
        private BigDecimal unitCost;
        private BigDecimal totalCost;
        private String notes;

        public static GrnItemDto from(GrnItem item) {
            return GrnItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productBarcode(item.getProduct().getBarcode())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .quantityReceived(item.getQuantityReceived())
                    .unitCost(item.getUnitCost())
                    .totalCost(item.getTotalCost())
                    .notes(item.getNotes())
                    .build();
        }
    }
}
