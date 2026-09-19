package com.nbh.erp.product.dto;

import com.nbh.erp.product.entity.Product;
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
public class ProductDto {
    private Long id;
    private String sku;
    private String barcode;
    private String name;
    private String description;
    private Long categoryId;
    private String categoryName;
    private Long supplierId;
    private String supplierName;
    private String unitOfMeasure;
    private BigDecimal costPrice;
    private BigDecimal sellingPrice;
    private Integer minStockLevel;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Boolean getActive() {
        return isActive;
    }

    public static ProductDto from(Product p) {
        return ProductDto.builder()
                .id(p.getId())
                .sku(p.getSku())
                .barcode(p.getBarcode())
                .name(p.getName())
                .description(p.getDescription())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .supplierId(p.getDefaultSupplier() != null ? p.getDefaultSupplier().getId() : null)
                .supplierName(p.getDefaultSupplier() != null ? p.getDefaultSupplier().getName() : null)
                .unitOfMeasure(p.getUnitOfMeasure())
                .costPrice(p.getCostPrice())
                .sellingPrice(p.getSellingPrice())
                .minStockLevel(p.getMinStockLevel())
                .isActive(p.getIsActive())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
