package com.nbh.erp.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
public class CreateInvoiceRequest {

    private Long customerId; // If null, defaults to walk-in customer

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    private Long salesmanId;

    private String paymentType = "CASH"; // CASH, CARD, CREDIT, BANK_TRANSFER

    private BigDecimal discountAmount = BigDecimal.ZERO;

    private BigDecimal taxRate = BigDecimal.ZERO;

    private BigDecimal paidAmount; // If null, defaults to netTotal for cash/card

    private LocalDate invoiceDate;

    private String notes;

    private boolean hold = false; // If true, saved as HELD cart

    @NotEmpty(message = "Invoice must contain at least one line item")
    @Valid
    private List<CreateInvoiceItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateInvoiceItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        private BigDecimal quantity;

        @NotNull(message = "Unit price is required")
        @PositiveOrZero(message = "Unit price cannot be negative")
        private BigDecimal unitPrice;

        private BigDecimal discountRate = BigDecimal.ZERO;

        private BigDecimal discountAmount = BigDecimal.ZERO;
    }
}
