package com.nbh.erp.stockadjustment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStockAdjustmentRequest {

    @NotNull(message = "Warehouse ID is required")
    @jakarta.validation.constraints.Positive
    private Long warehouseId;

    @jakarta.validation.constraints.Pattern(regexp="ADDITION|REDUCTION",message="Choose addition or reduction")
    private String adjustmentType;

    @NotNull(message = "Adjustment date is required")
    private LocalDate adjustmentDate;

    @jakarta.validation.constraints.Size(max=5000)
    private String reason;

    @NotEmpty(message = "Stock adjustment must have at least one line item")
    @Valid
    private List<CreateStockAdjustmentItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateStockAdjustmentItemRequest {

        @NotNull(message = "Product ID is required")
        @jakarta.validation.constraints.Positive
        private Long productId;

        @PositiveOrZero(message = "Physical quantity cannot be negative")
        @jakarta.validation.constraints.Digits(integer=36,fraction=2)
        private BigDecimal physicalQuantity;

        @jakarta.validation.constraints.Positive(message="Adjustment quantity must be greater than zero")
        @jakarta.validation.constraints.Digits(integer=13,fraction=2)
        private BigDecimal quantity;

        @jakarta.validation.constraints.AssertTrue(message="Enter either an adjustment quantity or a physical count")
        public boolean isQuantitySpecified(){return (quantity!=null) != (physicalQuantity!=null);}

        @PositiveOrZero(message="Unit cost cannot be negative")
        @jakarta.validation.constraints.Digits(integer=32,fraction=6)
        private BigDecimal unitCost;

        @jakarta.validation.constraints.Size(max=255)
        private String reason;
    }
}
