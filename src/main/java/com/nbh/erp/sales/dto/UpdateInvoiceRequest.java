package com.nbh.erp.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
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
public class UpdateInvoiceRequest {

    private Long customerId;
    private String customerName;
    private Long warehouseId;
    private Long salesmanId;
    private String status; // PAID, PARTIAL, PENDING, COMPLETED, HELD, CANCELLED, VOIDED
    private String paymentType; // FULL_PAYMENT, INSTALLMENT, CREDIT, CASH
    private String paymentMethod; // CASH, CARD, BANK_TRANSFER, CHEQUE

    @DecimalMin(value = "0.00", message = "Subtotal cannot be negative")
    private BigDecimal subtotal;

    @DecimalMin(value = "0.00", message = "Discount cannot be negative")
    private BigDecimal discountAmount;

    @DecimalMin(value = "0.00", message = "Tax rate cannot be negative")
    private BigDecimal taxRate;

    @DecimalMin(value = "0.00", message = "Tax amount cannot be negative")
    private BigDecimal taxAmount;

    @DecimalMin(value = "0.00", message = "Total amount cannot be negative")
    private BigDecimal totalAmount;

    @DecimalMin(value = "0.00", message = "Paid amount cannot be negative")
    private BigDecimal paidAmount;

    @DecimalMin(value = "0.00", message = "Balance amount cannot be negative")
    private BigDecimal balanceAmount;

    private LocalDate invoiceDate;
    private String notes;

    @Valid
    private List<UpdateInvoiceItemRequest> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateInvoiceItemRequest {
        private Long id;
        private Long productId;
        private String sku;
        private String name;

        @PositiveOrZero(message = "Quantity cannot be negative")
        private BigDecimal quantity;

        @PositiveOrZero(message = "Unit price cannot be negative")
        private BigDecimal unitPrice;

        @DecimalMin(value = "0.00", message = "Discount rate cannot be negative")
        private BigDecimal discountRate;

        @DecimalMin(value = "0.00", message = "Discount amount cannot be negative")
        private BigDecimal discountAmount;

        @DecimalMin(value = "0.00", message = "Total price cannot be negative")
        private BigDecimal totalPrice;
    }
}
