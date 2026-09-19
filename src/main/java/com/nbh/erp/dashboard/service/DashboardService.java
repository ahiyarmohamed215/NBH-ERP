package com.nbh.erp.dashboard.service;

import com.nbh.erp.dashboard.dto.DashboardDto;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.report.service.ReportService;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final InvoiceRepository invoiceRepository;
    private final GrnRepository grnRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final ReportService reportService;

    @Transactional(readOnly = true)
    public DashboardDto getDashboardSummary() {
        LocalDate today = LocalDate.now();

        BigDecimal todaySales = invoiceRepository.getTotalSalesForDate(today);
        long todayOrders = invoiceRepository.countCompletedInvoicesForDate(today);

        var valuation = reportService.getInventoryValuation(null);
        long heldCount = invoiceRepository.findByStatus("HELD").size();

        List<InvoiceDto> recentInvoices = invoiceRepository
                .findAll(PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(InvoiceDto::from)
                .collect(Collectors.toList());

        List<GrnDto> recentGrns = grnRepository
                .findAll(PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(GrnDto::from)
                .collect(Collectors.toList());

        return DashboardDto.builder()
                .todaySales(todaySales != null ? todaySales : BigDecimal.ZERO)
                .todayOrders(todayOrders)
                .totalInventoryValue(valuation.getTotalCostValuation())
                .lowStockCount(valuation.getLowStockAlertCount())
                .heldInvoicesCount(heldCount)
                .recentInvoices(recentInvoices)
                .recentGrns(recentGrns)
                .build();
    }
}
