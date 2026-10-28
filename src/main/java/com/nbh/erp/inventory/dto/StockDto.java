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
    private Long categoryId;
    private String categoryName;
    private Long brandId;
    private String brandName;
    private BigDecimal markupPercent;
    private BigDecimal brandMarkupPercent;
    private Boolean useBrandMarkup;

    public static StockDto from(StockBalance sb) {
        return from(sb, com.nbh.erp.security.SecurityUtils.canViewCostPrice());
    }

    public static StockDto from(StockBalance sb, boolean allowCostPrice) {
        if (sb == null) return null;

        BigDecimal qty = sb.getQuantity() != null ? sb.getQuantity() : BigDecimal.ZERO;
        BigDecimal reserved = sb.getReservedQuantity() != null ? sb.getReservedQuantity() : BigDecimal.ZERO;
        BigDecimal available = qty.subtract(reserved);

        BigDecimal cost = null;
        BigDecimal totalValue = null;
        if (allowCostPrice && sb.getProduct() != null) {
            cost = sb.getProduct().getCostPrice();
            totalValue = cost != null ? cost.multiply(qty) : BigDecimal.ZERO;
        }

        Integer minLevel = sb.getProduct() != null ? sb.getProduct().getMinStockLevel() : 0;
        Boolean lowStock = minLevel != null && available.compareTo(BigDecimal.valueOf(minLevel)) <= 0;

        Long categoryId = null;
        String categoryName = null;
        if (sb.getProduct() != null && sb.getProduct().getCategory() != null) {
            categoryId = sb.getProduct().getCategory().getId();
            categoryName = sb.getProduct().getCategory().getName();
        }

        Long brandId = null;
        String brandName = null;
        if (sb.getProduct() != null && sb.getProduct().getBrand() != null) {
            brandId = sb.getProduct().getBrand().getId();
            brandName = sb.getProduct().getBrand().getName();
        }

        BigDecimal markupPercent = sb.getProduct() != null && sb.getProduct().getMarkupPercent() != null
                ? sb.getProduct().getMarkupPercent()
                : BigDecimal.ZERO;

        Boolean useBrandMarkup = sb.getProduct() != null ? sb.getProduct().isBrandMarkupPricing() : null;

        return StockDto.builder()
                .id(sb.getId())
                .warehouseId(sb.getWarehouse() != null ? sb.getWarehouse().getId() : null)
                .warehouseCode(sb.getWarehouse() != null ? sb.getWarehouse().getCode() : null)
                .warehouseName(sb.getWarehouse() != null ? sb.getWarehouse().getName() : null)
                .productId(sb.getProduct() != null ? sb.getProduct().getId() : null)
                .productSku(sb.getProduct() != null ? sb.getProduct().getSku() : null)
                .productBarcode(sb.getProduct() != null ? sb.getProduct().getBarcode() : null)
                .productName(sb.getProduct() != null ? sb.getProduct().getName() : null)
                .unitOfMeasure(sb.getProduct() != null ? sb.getProduct().getUnitOfMeasure() : null)
                .quantity(qty)
                .reservedQuantity(reserved)
                .availableQuantity(available)
                .costPrice(cost)
                .sellingPrice(sb.getProduct() != null ? sb.getProduct().getSellingPrice() : null)
                .totalCostValue(totalValue)
                .minStockLevel(minLevel)
                .isLowStock(lowStock)
                .categoryId(categoryId)
                .categoryName(categoryName)
                .brandId(brandId)
                .brandName(brandName)
                .markupPercent(markupPercent)
                .brandMarkupPercent(markupPercent)
                .useBrandMarkup(useBrandMarkup)
                .build();
    }
}
