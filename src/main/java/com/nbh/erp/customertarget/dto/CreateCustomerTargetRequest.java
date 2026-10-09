package com.nbh.erp.customertarget.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class CreateCustomerTargetRequest {

    private String targetCode;

    @NotBlank(message = "Target name is required")
    private String name;

    private String description;

    // Optional: if null, applies across all customers or specified group
    private Long customerId;

    private Long customerGroupId;

    private Long salesmanId;

    @Builder.Default
    private String targetType = "TOTAL_SALES";

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    @NotNull(message = "Target amount is required")
    private BigDecimal targetAmount;

    @Builder.Default
    private String rewardType = "PERCENTAGE_DISCOUNT";

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private List<TierRequest> tiers = new ArrayList<>();

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TierRequest {
        private Long id;
        private Integer tierLevel;
        private String tierName;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private BigDecimal discountPercentage;
        private BigDecimal discountAmount;
        private String rewardDescription;
    }
}
