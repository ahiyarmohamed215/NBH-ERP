package com.nbh.erp.customertarget.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerTargetTierDto {
    private Long id;
    private Integer tierLevel;
    private String tierName;
    private BigDecimal minAmount;
    private BigDecimal maxAmount;
    private BigDecimal discountPercentage;
    private BigDecimal discountAmount;
    private String rewardDescription;
    private Boolean isAchieved;
}
