package com.nbh.erp.customertarget.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customergroup.entity.CustomerGroup;
import com.nbh.erp.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "customer_targets", indexes = {
        @Index(name = "idx_cust_target_date", columnList = "start_date, end_date"),
        @Index(name = "idx_cust_target_active", columnList = "is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerTarget extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "target_code", nullable = false, unique = true, length = 50)
    private String targetCode;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_group_id")
    private CustomerGroup customerGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "salesman_id")
    private User salesman;

    @Column(name = "target_type", nullable = false, length = 30)
    @Builder.Default
    private String targetType = "TOTAL_SALES"; // TOTAL_SALES, INVOICE_AMOUNT

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "target_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal targetAmount = BigDecimal.ZERO;

    @Column(name = "reward_type", nullable = false, length = 30)
    @Builder.Default
    private String rewardType = "PERCENTAGE_DISCOUNT"; // PERCENTAGE_DISCOUNT, FIXED_DISCOUNT

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @OneToMany(mappedBy = "customerTarget", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("tierLevel ASC")
    @Builder.Default
    private List<CustomerTargetTier> tiers = new ArrayList<>();

    public void addTier(CustomerTargetTier tier) {
        if (tiers == null) {
            tiers = new ArrayList<>();
        }
        tiers.add(tier);
        tier.setCustomerTarget(this);
    }

    public void removeTier(CustomerTargetTier tier) {
        if (tiers != null) {
            tiers.remove(tier);
            tier.setCustomerTarget(null);
        }
    }
}
