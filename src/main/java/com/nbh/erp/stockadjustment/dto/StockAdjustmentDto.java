package com.nbh.erp.stockadjustment.dto;

import com.nbh.erp.stockadjustment.entity.StockAdjustment;
import com.nbh.erp.stockadjustment.entity.StockAdjustmentItem;
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
public class StockAdjustmentDto {
    private Long id;
    private String adjustmentNumber;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private String status;
    private LocalDate adjustmentDate;
    private String reason;
    private String approvedBy;
    private LocalDateTime approvedAt;
    private List<StockAdjustmentItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static StockAdjustmentDto from(StockAdjustment sa) {
        return StockAdjustmentDto.builder()
                .id(sa.getId())
                .adjustmentNumber(sa.getAdjustmentNumber())
                .warehouseId(sa.getWarehouse().getId())
                .warehouseCode(sa.getWarehouse().getCode())
                .warehouseName(sa.getWarehouse().getName())
                .status(sa.getStatus())
                .adjustmentDate(sa.getAdjustmentDate())
                .reason(sa.getReason())
                .approvedBy(sa.getApprovedBy())
                .approvedAt(sa.getApprovedAt())
                .createdBy(sa.getCreatedBy())
                .createdAt(sa.getCreatedAt())
                .items(sa.getItems() != null
                        ? sa.getItems().stream().map(StockAdjustmentItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockAdjustmentItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productName;
        private String unitOfMeasure;
        private BigDecimal systemQuantity;
        private BigDecimal physicalQuantity;
        private BigDecimal differenceQuantity;
        private BigDecimal unitCost;
        private String reason;

        public static StockAdjustmentItemDto from(StockAdjustmentItem item) {
            return StockAdjustmentItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .systemQuantity(item.getSystemQuantity())
                    .physicalQuantity(item.getPhysicalQuantity())
                    .differenceQuantity(item.getDifferenceQuantity())
                    .unitCost(item.getUnitCost())
                    .reason(item.getReason())
                    .build();
        }
    }
}
