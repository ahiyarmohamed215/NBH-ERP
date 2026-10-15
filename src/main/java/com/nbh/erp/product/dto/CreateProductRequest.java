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

    @Size(max=50)
    private String sku; // Auto-generated if null

    @Size(max=50)
    private String barcode;

    @Size(max = 200)
    private String name;

    @jakarta.validation.constraints.Size(max=5000)
    private String description;

    @jakarta.validation.constraints.Positive
    private Long categoryId;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;

    @jakarta.validation.constraints.Positive
    private Long brandId;

    @jakarta.validation.constraints.Positive
    private Long supplierId;

    @jakarta.validation.constraints.Positive
    private Long warehouseId;

    @jakarta.validation.constraints.Positive
    private Long defaultWarehouseId;

    public Long getEffectiveWarehouseId() {
        return warehouseId != null ? warehouseId : defaultWarehouseId;
    }

    @Size(max=20)
    private String unitOfMeasure = "PCS";

    @PositiveOrZero(message = "Cost price cannot be negative")
    @jakarta.validation.constraints.Digits(integer=36,fraction=2)
    private BigDecimal costPrice;

    @PositiveOrZero(message = "Selling price cannot be negative")
    @jakarta.validation.constraints.Digits(integer=36,fraction=2)
    private BigDecimal sellingPrice;
    private Boolean useBrandMarkup;

    @jakarta.validation.constraints.Min(0)
    private Integer minStockLevel = 5;
}
