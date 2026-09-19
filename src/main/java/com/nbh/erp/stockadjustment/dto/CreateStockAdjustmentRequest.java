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
    private Long warehouseId;

    @NotNull(message = "Adjustment date is required")
    private LocalDate adjustmentDate;

    private String reason;

    @NotEmpty(message = "Stock adjustment must have at least one line item")
    @Valid
    private List<CreateStockAdjustmentItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateStockAdjustmentItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Physical quantity is required")
        @PositiveOrZero(message = "Physical quantity cannot be negative")
        private BigDecimal physicalQuantity;

        private String reason;
    }
}
