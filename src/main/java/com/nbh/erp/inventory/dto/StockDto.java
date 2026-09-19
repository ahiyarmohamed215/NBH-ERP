package com.nbh.erp.inventory.dto;

import com.nbh.erp.inventory.entity.StockBalance;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockDto {
    private Long id;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private Long productId;
    private String productSku;
    private String productBarcode;
    private String productName;
    private String unitOfMeasure;
    private BigDecimal quantity;
    private BigDecimal reservedQuantity;
    private BigDecimal availableQuantity;
    private BigDecimal costPrice;
    private BigDecimal sellingPrice;
    private BigDecimal totalCostValue;
    private Integer minStockLevel;
    private Boolean isLowStock;

    public static StockDto from(StockBalance sb) {
        BigDecimal qty = sb.getQuantity() != null ? sb.getQuantity() : BigDecimal.ZERO;
        BigDecimal reserved = sb.getReservedQuantity() != null ? sb.getReservedQuantity() : BigDecimal.ZERO;
        BigDecimal available = qty.subtract(reserved);
        BigDecimal cost = sb.getProduct().getCostPrice() != null ? sb.getProduct().getCostPrice() : BigDecimal.ZERO;
        BigDecimal totalValue = qty.multiply(cost);

        int minLevel = sb.getProduct().getMinStockLevel() != null ? sb.getProduct().getMinStockLevel() : 0;
        boolean lowStock = qty.compareTo(BigDecimal.valueOf(minLevel)) <= 0;

        return StockDto.builder()
                .id(sb.getId())
                .warehouseId(sb.getWarehouse().getId())
                .warehouseCode(sb.getWarehouse().getCode())
                .warehouseName(sb.getWarehouse().getName())
                .productId(sb.getProduct().getId())
                .productSku(sb.getProduct().getSku())
                .productBarcode(sb.getProduct().getBarcode())
                .productName(sb.getProduct().getName())
                .unitOfMeasure(sb.getProduct().getUnitOfMeasure())
                .quantity(qty)
                .reservedQuantity(reserved)
                .availableQuantity(available)
                .costPrice(cost)
                .sellingPrice(sb.getProduct().getSellingPrice())
                .totalCostValue(totalValue)
                .minStockLevel(minLevel)
                .isLowStock(lowStock)
                .build();
    }
}
