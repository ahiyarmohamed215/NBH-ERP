package com.nbh.erp.grn.dto;

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
public class CreateGrnRequest {

    @NotNull(message = "Supplier ID is required")
    private Long supplierId;

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    private String supplierInvoiceNumber;

    @NotNull(message = "Received date is required")
    private LocalDate receivedDate;

    private String notes;

    @NotEmpty(message = "GRN must have at least one line item")
    @Valid
    private List<CreateGrnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGrnItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Received quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        private BigDecimal quantityReceived;

        @NotNull(message = "Unit cost is required")
        @Positive(message = "Unit cost must be greater than zero")
        private BigDecimal unitCost;

        private String notes;
    }
}
