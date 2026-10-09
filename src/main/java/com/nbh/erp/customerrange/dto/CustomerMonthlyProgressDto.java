package com.nbh.erp.customerrange.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerMonthlyProgressDto {

    // Customer Identity
    private Long customerId;
    private String customerCode;
    private String customerName;
    private String customerPhone;
    private Long assignedStaffId;
    private String assignedStaffName;
    private String assignedStaffUsername;

    // Monthly Target Status
    private String yearMonth; // 'YYYY-MM'
    private String monthLabel; // e.g. 'October 2026'
    private BigDecimal monthlyPurchases; // Current qualifying purchases
    private Integer invoiceCount;
    private LocalDate lastPurchaseDate;

    // Current Range
    private Long currentRangeId;
    private String currentRangeCode;
    private String currentRangeName;
    private BigDecimal currentRangeThreshold;

    // Next Target Range
    private Long nextRangeId;
    private String nextRangeCode;
    private String nextRangeName;
    private BigDecimal nextRangeThreshold;
    private BigDecimal remainingAmount; // Amount needed to achieve next range
    private BigDecimal progressPercentage; // Progress % towards next range
    private Boolean isHighestRange;

    // Live POS Cart Projections (if active bill/cart amount is provided)
    private BigDecimal currentBillAmount;
    private BigDecimal projectedMonthlyPurchases;
    private Long projectedRangeId;
    private String projectedRangeCode;
    private String projectedRangeName;
    private Long projectedNextRangeId;
    private String projectedNextRangeName;
    private BigDecimal projectedNextTarget;
    private BigDecimal projectedRemainingAmount;
    private BigDecimal projectedProgressPercentage;
    private Boolean willAchieveNewRange;
    private Boolean isProjectedHighestRange;
    private String achievementNotificationMessage;
}
