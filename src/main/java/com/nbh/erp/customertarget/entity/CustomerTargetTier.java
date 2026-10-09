package com.nbh.erp.customertarget.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "customer_target_tiers", indexes = {
        @Index(name = "idx_tier_target", columnList = "target_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerTargetTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_id", nullable = false)
    private CustomerTarget customerTarget;

    @Column(name = "tier_level", nullable = false)
    private Integer tierLevel;

    @Column(name = "tier_name", nullable = false, length = 100)
    private String tierName;

    @Column(name = "min_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal minAmount = BigDecimal.ZERO;

    @Column(name = "max_amount", precision = 15, scale = 2)
    private BigDecimal maxAmount; // Nullable: indicates open-ended top tier (e.g. 100,000+)

    @Column(name = "discount_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discountPercentage = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "reward_description", length = 255)
    private String rewardDescription;
}
