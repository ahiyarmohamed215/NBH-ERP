package com.nbh.erp.customerrange.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffPerformanceDto {
    private Long staffId;
    private String staffName;
    private String staffUsername;
    private long totalAssignedCustomers;
    private long activePurchasingCustomers;
    private long promotedCustomers; // Reached Range 1 or above
    private long customersCloseToTarget;
    private BigDecimal totalQualifyingPurchases;
}
