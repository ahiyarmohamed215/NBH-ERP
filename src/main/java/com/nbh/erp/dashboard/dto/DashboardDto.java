package com.nbh.erp.dashboard.dto;

import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.sales.dto.InvoiceDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDto {
    private BigDecimal todaySales;
    private long todayOrders;
    private BigDecimal totalInventoryValue;
    private long lowStockCount;
    private long heldInvoicesCount;
    private List<InvoiceDto> recentInvoices;
    private List<GrnDto> recentGrns;
}
