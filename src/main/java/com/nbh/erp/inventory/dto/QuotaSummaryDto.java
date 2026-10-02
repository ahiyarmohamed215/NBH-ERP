package com.nbh.erp.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaSummaryDto {

    private long totalQuotas;
    private long activeQuotas;
    private long exhaustedQuotas;
    private BigDecimal totalAllocatedUnits;
    private BigDecimal totalSoldUnits;
    private BigDecimal totalRemainingUnits;
    private long distinctProductsRestricted;
    private long distinctStaffRestricted;
}
