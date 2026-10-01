package com.nbh.erp.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliverySummaryDto {
    private long totalDeliveries;
    private long scheduledCount;
    private long inTransitCount; // On Route
    private long deliveredCount;
    private long cancelledCount;
    private long todayDeliveriesCount;
    private long pendingInvoicesForDeliveryCount;
    private BigDecimal totalDeliveredAmount;
}
