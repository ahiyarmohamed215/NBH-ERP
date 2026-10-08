package com.nbh.erp.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateInvoiceRequest {

    private Long customerId; // If null, defaults to walk-in customer

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    private Long salesmanId;
    private String paymentMethod;

    @Builder.Default
    private String paymentType = "CASH"; // CASH, CARD, CREDIT, BANK_TRANSFER

    @Builder.Default
    @PositiveOrZero
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Builder.Default
    @PositiveOrZero
    @jakarta.validation.constraints.DecimalMax("100")
    private BigDecimal taxRate = BigDecimal.ZERO;

    @PositiveOrZero
    @jakarta.validation.constraints.Digits(integer=13, fraction=2)
    private BigDecimal paidAmount; // If null, defaults to netTotal for cash/card

    private LocalDate invoiceDate;

    private String notes;

    @Builder.Default
    private Boolean hold = false; // If true, saved as HELD cart

    public boolean isHold() {
        return Boolean.TRUE.equals(this.hold);
    }

    @NotEmpty(message = "Invoice must contain at least one line item")
    @Valid
    private List<CreateInvoiceItemRequest> items;

    @Data
    @Builder
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

        @Builder.Default
        @PositiveOrZero
        @jakarta.validation.constraints.DecimalMax("100")
        private BigDecimal discountRate = BigDecimal.ZERO;

        @Builder.Default
        @PositiveOrZero
        private BigDecimal discountAmount = BigDecimal.ZERO;
    }
}
