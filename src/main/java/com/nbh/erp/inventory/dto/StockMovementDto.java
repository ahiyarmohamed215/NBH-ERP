package com.nbh.erp.inventory.dto;

import com.nbh.erp.inventory.entity.StockMovement;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockMovementDto {
    private Long id;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private Long productId;
    private String productSku;
    private String productName;
    private String movementType;
    private BigDecimal quantity;
    private BigDecimal balanceBefore;
    private BigDecimal balanceAfter;
    private BigDecimal unitCost;
    private String referenceType;
    private String referenceNumber;
    private String notes;
    private Long createdByUserId;
    private LocalDateTime createdAt;

    public static StockMovementDto from(StockMovement sm) {
        return StockMovementDto.builder()
                .id(sm.getId())
                .warehouseId(sm.getWarehouse().getId())
                .warehouseCode(sm.getWarehouse().getCode())
                .warehouseName(sm.getWarehouse().getName())
                .productId(sm.getProduct().getId())
                .productSku(sm.getProduct().getSku())
                .productName(sm.getProduct().getName())
                .movementType(sm.getMovementType())
                .quantity(sm.getQuantity())
                .balanceBefore(sm.getBalanceBefore())
                .balanceAfter(sm.getBalanceAfter())
                .unitCost(sm.getUnitCost())
                .referenceType(sm.getReferenceType())
                .referenceNumber(sm.getReferenceNumber())
                .notes(sm.getNotes())
                .createdByUserId(sm.getCreatedByUserId())
                .createdAt(sm.getCreatedAt())
                .build();
    }
}
