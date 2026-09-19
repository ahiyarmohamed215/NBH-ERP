package com.nbh.erp.salesreturn.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sales_returns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalesReturn extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "return_number", nullable = false, unique = true, length = 50)
    private String returnNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "COMPLETED"; // DRAFT, COMPLETED, REJECTED

    @Column(name = "return_type", nullable = false, length = 30)
    @Builder.Default
    private String returnType = "REFUND"; // REFUND, CREDIT_NOTE, RESTOCK

    @Column(name = "total_amount", nullable = false)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "return_date", nullable = false)
    private LocalDate returnDate;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @OneToMany(mappedBy = "salesReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SalesReturnItem> items = new ArrayList<>();
}
