package com.nbh.erp.report.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.report.dto.ReportDto;
import com.nbh.erp.report.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Tag(name = "Reports & Analytics", description = "Business intelligence, valuation, and Excel export APIs")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/sales-summary")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('REPORT_VIEW')")
    @Operation(summary = "Get sales revenue summary and daily time-series breakdown")
    public ResponseEntity<ApiResponse<ReportDto.SalesSummaryReport>> getSalesSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        ReportDto.SalesSummaryReport report = reportService.getSalesSummary(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(report));
    }

    @GetMapping("/inventory-valuation")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('REPORT_VIEW')")
    @Operation(summary = "Get inventory asset valuation and low stock count")
    public ResponseEntity<ApiResponse<ReportDto.InventoryValuationReport>> getInventoryValuation(
            @RequestParam(required = false) Long warehouseId
    ) {
        ReportDto.InventoryValuationReport report = reportService.getInventoryValuation(warehouseId);
        return ResponseEntity.ok(ApiResponse.ok(report));
    }

    @GetMapping("/inventory/excel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('REPORT_VIEW')")
    @Operation(summary = "Download complete inventory spreadsheet in Excel format (.xlsx)")
    public ResponseEntity<byte[]> downloadInventoryExcel(@RequestParam(required = false) Long warehouseId) {
        byte[] bytes = reportService.exportInventoryToExcel(warehouseId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "inventory_report_" + LocalDate.now() + ".xlsx");

        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}
