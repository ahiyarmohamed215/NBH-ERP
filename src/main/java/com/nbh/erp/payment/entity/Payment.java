package com.nbh.erp.payment.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.sales.entity.Invoice;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_pmt_date", columnList = "payment_date"),
        @Index(name = "idx_pmt_customer", columnList = "customer_id"),
        @Index(name = "idx_pmt_invoice", columnList = "invoice_id"),
        @Index(name = "idx_pmt_status", columnList = "status"),
        @Index(name = "idx_pmt_type", columnList = "payment_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_number", nullable = false, unique = true, length = 50)
    private String paymentNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_method", nullable = false, length = 30)
    @Builder.Default
    private String paymentMethod = "CASH";

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "COMPLETED"; // COMPLETED, VOIDED

    @Column(name = "payment_type", length = 30)
    @Builder.Default
    private String paymentType = "INVOICE_PAYMENT"; // INVOICE_PAYMENT, ADVANCE

    @Column(columnDefinition = "TEXT")
    private String notes;
}
