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
public class CustomerRangeHistoryDto {
    private String yearMonth;
    private String monthLabel;
    private BigDecimal qualifyingPurchases;
    private String finalRangeName;
    private String finalRangeCode;
    private BigDecimal finalRangeMinSpend;
    private Integer invoiceCount;
    private LocalDate lastPurchaseDate;
}
