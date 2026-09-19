package com.nbh.erp.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class ReportDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesSummaryReport {
        private LocalDate startDate;
        private LocalDate endDate;
        private long totalInvoices;
        private BigDecimal totalRevenue;
        private BigDecimal totalDiscount;
        private BigDecimal totalTax;
        private BigDecimal totalPaid;
        private BigDecimal totalDue;
        private List<DailySalesPoint> dailyBreakdown;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailySalesPoint {
        private LocalDate date;
        private long count;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InventoryValuationReport {
        private Long warehouseId;
        private String warehouseName;
        private long totalDistinctProducts;
        private BigDecimal totalPhysicalUnits;
        private BigDecimal totalCostValuation;
        private BigDecimal totalRetailValuation;
        private long lowStockAlertCount;
    }
}
