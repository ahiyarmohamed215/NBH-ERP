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
public class StaffCustomerTargetDto {
    private Long customerId;
    private String customerCode;
    private String customerName;
    private String customerPhone;
    private String contactPerson;

    // Range status
    private Long currentRangeId;
    private String currentRangeName;
    private String currentRangeCode;
    private BigDecimal monthlyPurchases;

    // Next Target
    private Long nextRangeId;
    private String nextRangeName;
    private BigDecimal nextTargetAmount;
    private BigDecimal remainingAmount;
    private BigDecimal progressPercentage;
    private Boolean isCloseToTarget; // True if remaining is small or progress is >= 75%
    private Boolean isHighestRange;

    // Activity
    private LocalDate lastPurchaseDate;
    private String latestInvoiceNumber;
    private BigDecimal latestInvoiceAmount;

    // Assigned staff info
    private Long assignedStaffId;
    private String assignedStaffName;
}
