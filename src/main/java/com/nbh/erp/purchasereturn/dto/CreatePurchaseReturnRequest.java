package com.nbh.erp.purchasereturn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePurchaseReturnRequest {
    private String statusReason;

    private Long supplierId;
    private Long sourceGrnId;

    private Long warehouseId;

    @NotNull(message = "Return date is required")
    private LocalDate returnDate;

    private String reason;
    private String remarks;

    @NotEmpty(message = "Purchase return must contain at least one line item")
    @Valid
    private List<CreatePurchaseReturnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePurchaseReturnItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Return quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        private BigDecimal quantityReturned;

        @NotNull(message = "Unit cost is required")
        @jakarta.validation.constraints.PositiveOrZero(message = "Unit cost cannot be negative")
        private BigDecimal unitCost;

        private String reason;
        private Long sourceGrnId;
        private Long warehouseId;
        private String remarks;
    }
}
