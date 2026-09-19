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

    @NotBlank(message = "Product name is required")
    @Size(min = 2, max = 200)
    private String name;

    private String description;

    @NotNull(message = "Category ID is required")
    private Long categoryId;

    private Long supplierId;

    private String unitOfMeasure = "PCS";

    @NotNull(message = "Cost price is required")
    @PositiveOrZero(message = "Cost price cannot be negative")
    private BigDecimal costPrice;

    @NotNull(message = "Selling price is required")
    @PositiveOrZero(message = "Selling price cannot be negative")
    private BigDecimal sellingPrice;

    private Integer minStockLevel = 5;
}
