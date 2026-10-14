package com.nbh.erp.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateProductRequest {

    private String sku; // Auto-generated if null

    private String barcode;

    @Size(max = 200)
    private String name;

    private String description;

    private Long categoryId;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;

    private Long brandId;

    private Long supplierId;

    private Long warehouseId;

    private Long defaultWarehouseId;

    public Long getEffectiveWarehouseId() {
        return warehouseId != null ? warehouseId : defaultWarehouseId;
    }

    private String unitOfMeasure = "PCS";

    @PositiveOrZero(message = "Cost price cannot be negative")
    private BigDecimal costPrice;

    @PositiveOrZero(message = "Selling price cannot be negative")
    private BigDecimal sellingPrice;
    private Boolean useBrandMarkup;

    private Integer minStockLevel = 5;
}
