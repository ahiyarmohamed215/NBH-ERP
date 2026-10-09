package com.nbh.erp.customerrange.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "customer_monthly_summaries", uniqueConstraints = {
        @UniqueConstraint(name = "uk_cust_month", columnNames = {"customer_id", "year_month"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerMonthlySummary extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "year_month", nullable = false, length = 7)
    private String yearMonth; // Format: 'YYYY-MM', e.g. '2026-10'

    @Column(name = "qualifying_purchases", nullable = false, precision = 38, scale = 2)
    @Builder.Default
    private BigDecimal qualifyingPurchases = BigDecimal.ZERO;

    @Column(name = "invoice_count", nullable = false)
    @Builder.Default
    private Integer invoiceCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_range_id", nullable = false)
    private CustomerRangeConfig currentRange;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "highest_range_achieved_id", nullable = false)
    private CustomerRangeConfig highestRangeAchieved;

    @Column(name = "last_purchase_date")
    private LocalDate lastPurchaseDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_invoice_id")
    private Invoice lastInvoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;
}
