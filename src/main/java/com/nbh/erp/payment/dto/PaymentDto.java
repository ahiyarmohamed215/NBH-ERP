package com.nbh.erp.payment.dto;

import com.nbh.erp.payment.entity.Payment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentDto {

    private Long id;
    private String paymentNumber;
    private String receiptNo; // Alias for frontend compatibility
    private Long invoiceId;
    private String invoiceNumber;
    private String invoiceNo; // Alias for frontend compatibility
    private Long customerId;
    private String customerName;
    private BigDecimal amount;
    private String paymentMethod;
    private String referenceNumber;
    private LocalDate paymentDate;
    private String status;
    private String paymentType;
    private String voucherNo; // Alias for advance payments
    private String notes;
    private LocalDateTime createdAt;
    private String createdBy;

    public static PaymentDto from(Payment p) {
        if (p == null) return null;
        String invNum = p.getInvoice() != null ? p.getInvoice().getInvoiceNumber() : null;
        Long invId = p.getInvoice() != null ? p.getInvoice().getId() : null;
        String custName = p.getCustomer() != null ? p.getCustomer().getName() : (p.getInvoice() != null && p.getInvoice().getCustomer() != null ? p.getInvoice().getCustomer().getName() : "Walk-in");
        Long custId = p.getCustomer() != null ? p.getCustomer().getId() : null;

        return PaymentDto.builder()
                .id(p.getId())
                .paymentNumber(p.getPaymentNumber())
                .receiptNo(p.getPaymentNumber())
                .invoiceId(invId)
                .invoiceNumber(invNum)
                .invoiceNo(invNum)
                .customerId(custId)
                .customerName(custName)
                .amount(p.getAmount())
                .paymentMethod(p.getPaymentMethod())
                .referenceNumber(p.getReferenceNumber())
                .paymentDate(p.getPaymentDate())
                .status(p.getStatus())
                .paymentType(p.getPaymentType())
                .voucherNo(p.getPaymentNumber())
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .createdBy(p.getCreatedBy())
                .build();
    }
}
