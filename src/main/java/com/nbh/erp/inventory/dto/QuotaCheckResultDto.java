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
public class QuotaCheckResultDto {

    private boolean quotaRestricted; // True if this staff has an active quota on this product
    private boolean isAllowed;       // True if requested quantity is within remaining quota
    private BigDecimal allocatedQuantity;
    private BigDecimal soldQuantity;
    private BigDecimal remainingQuantity;
    private BigDecimal requestedQuantity;
    private String staffName;
    private String productName;
    private String message;
}
