package com.nbh.erp.customertarget.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerTargetProgressDto {
    private Long targetId;
    private String targetCode;
    private String targetName;
    private Long customerId;
    private String customerName;
    private LocalDate startDate;
    private LocalDate endDate;
    private Long daysRemaining;
    
    // Overall Target Goal
    private BigDecimal targetAmount;
    private BigDecimal currentAchievedAmount;
    private BigDecimal achievementPercentage;
    private Long completedInvoicesCount;
    private Boolean isGoalAchieved;

    // Currently unlocked range & reward
    private CustomerTargetTierDto currentTier;
    private BigDecimal currentDiscountPercentage;
    private BigDecimal currentDiscountAmount;
    private String currentRewardDescription;

    // Next milestone to incentivize customer & sales rep
    private CustomerTargetTierDto nextTier;
    private BigDecimal amountNeededForNextTier;

    // Full slabs for visualization in POS
    @Builder.Default
    private List<CustomerTargetTierDto> tiers = new ArrayList<>();
}
