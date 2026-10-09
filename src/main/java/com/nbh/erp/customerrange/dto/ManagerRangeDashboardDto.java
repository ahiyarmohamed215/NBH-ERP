package com.nbh.erp.customerrange.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerRangeDashboardDto {

    private String yearMonth;
    private String monthLabel;

    // High Level KPIs
    private long totalActiveCustomers;
    private long customersWithPurchases;
    private long customersWithZeroPurchases;
    private BigDecimal totalMonthlyQualifyingSales;
    private long promotedCustomersCount; // Customers in Range 1+
    private long customersCloseToTargetCount;

    // Range Distribution Breakdown
    private Map<String, Long> rangeCustomerCounts; // Range Name -> Count
    private List<CustomerRangeConfigDto> configuredRanges;

    // Filterable Customer Summaries (Paginated)
    private List<StaffCustomerTargetDto> customers;
    private int pageNumber;
    private int pageSize;
    private long totalElements;
    private int totalPages;
}
