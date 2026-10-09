package com.nbh.erp.customertarget.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerTargetDto {
    private Long id;
    private String targetCode;
    private String name;
    private String description;
    
    // Customer details
    private Long customerId;
    private String customerCode;
    private String customerName;

    // Customer group details
    private Long customerGroupId;
    private String customerGroupName;

    // Assigned staff / salesman
    private Long salesmanId;
    private String salesmanName;
    private String salesmanCode;

    private String targetType;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal targetAmount;
    private String rewardType;
    private Boolean isActive;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;

    // Range Slabs
    @Builder.Default
    private List<CustomerTargetTierDto> tiers = new ArrayList<>();

    // Real-time computed progress metrics
    private BigDecimal currentAchievedAmount;
    private BigDecimal achievementPercentage;
    private CustomerTargetTierDto currentAchievedTier;
    private BigDecimal currentDiscountPercentage;
    private BigDecimal currentDiscountAmount;
    private CustomerTargetTierDto nextTier;
    private BigDecimal amountNeededForNextTier;
    private Long invoiceCount;
    private Boolean isTargetAchieved;
    private Long daysRemaining;
}
