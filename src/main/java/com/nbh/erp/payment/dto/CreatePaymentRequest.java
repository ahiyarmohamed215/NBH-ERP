package com.nbh.erp.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePaymentRequest {

    private Long invoiceId;
    private String invoiceNumber;
    private Long customerId;
    private String customerName;

    @NotNull(message = "Payment amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero")
    private BigDecimal amount;

    private String paymentMethod; // CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE
    private String paymentType;   // INVOICE_PAYMENT, ADVANCE
    private String referenceNumber;
    private LocalDate paymentDate;
    private String notes;
}
