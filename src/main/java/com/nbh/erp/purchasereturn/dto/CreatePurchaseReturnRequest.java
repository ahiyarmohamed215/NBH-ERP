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

    @NotNull(message = "Supplier ID is required")
    private Long supplierId;

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotNull(message = "Return date is required")
    private LocalDate returnDate;

    private String reason;

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
        @Positive(message = "Unit cost must be greater than zero")
        private BigDecimal unitCost;

        private String reason;
    }
}
