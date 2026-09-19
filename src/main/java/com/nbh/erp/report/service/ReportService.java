package com.nbh.erp.report.service;

import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.report.dto.ReportDto;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final InvoiceRepository invoiceRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final WarehouseRepository warehouseRepository;

    @Transactional(readOnly = true)
    public ReportDto.SalesSummaryReport getSalesSummary(LocalDate startDate, LocalDate endDate) {
        final LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(30);
        final LocalDate end = endDate != null ? endDate : LocalDate.now();

        List<Invoice> invoices = invoiceRepository.findAll().stream()
                .filter(i -> "COMPLETED".equals(i.getStatus()))
                .filter(i -> !i.getInvoiceDate().isBefore(start) && !i.getInvoiceDate().isAfter(end))
                .collect(Collectors.toList());

        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal due = BigDecimal.ZERO;

        Map<LocalDate, List<Invoice>> byDate = new TreeMap<>();

        for (Invoice inv : invoices) {
            revenue = revenue.add(inv.getNetTotal());
            discount = discount.add(inv.getDiscountAmount());
            tax = tax.add(inv.getTaxAmount());
            paid = paid.add(inv.getPaidAmount());
            due = due.add(inv.getBalanceAmount());

            byDate.computeIfAbsent(inv.getInvoiceDate(), k -> new ArrayList<>()).add(inv);
        }

        List<ReportDto.DailySalesPoint> dailyList = new ArrayList<>();
        for (Map.Entry<LocalDate, List<Invoice>> entry : byDate.entrySet()) {
            BigDecimal dayRev = entry.getValue().stream().map(Invoice::getNetTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            dailyList.add(ReportDto.DailySalesPoint.builder()
                    .date(entry.getKey())
                    .count(entry.getValue().size())
                    .revenue(dayRev)
                    .build());
        }

        return ReportDto.SalesSummaryReport.builder()
                .startDate(startDate)
                .endDate(endDate)
                .totalInvoices(invoices.size())
                .totalRevenue(revenue)
                .totalDiscount(discount)
                .totalTax(tax)
                .totalPaid(paid)
                .totalDue(due)
                .dailyBreakdown(dailyList)
                .build();
    }

    @Transactional(readOnly = true)
    public ReportDto.InventoryValuationReport getInventoryValuation(Long warehouseId) {
        List<StockBalance> balances = warehouseId != null
                ? stockBalanceRepository.findByWarehouseId(warehouseId)
                : stockBalanceRepository.findAll();

        String whName = "All Warehouses Enterprise";
        if (warehouseId != null) {
            whName = warehouseRepository.findById(warehouseId).map(Warehouse::getName).orElse("Warehouse " + warehouseId);
        }

        BigDecimal totalUnits = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalRetail = BigDecimal.ZERO;
        long lowStockCount = 0;

        for (StockBalance sb : balances) {
            BigDecimal qty = sb.getQuantity() != null ? sb.getQuantity() : BigDecimal.ZERO;
            totalUnits = totalUnits.add(qty);

            BigDecimal costPrice = sb.getProduct().getCostPrice() != null ? sb.getProduct().getCostPrice() : BigDecimal.ZERO;
            BigDecimal sellPrice = sb.getProduct().getSellingPrice() != null ? sb.getProduct().getSellingPrice() : BigDecimal.ZERO;

            totalCost = totalCost.add(qty.multiply(costPrice));
            totalRetail = totalRetail.add(qty.multiply(sellPrice));

            int minLevel = sb.getProduct().getMinStockLevel() != null ? sb.getProduct().getMinStockLevel() : 0;
            if (qty.compareTo(BigDecimal.valueOf(minLevel)) <= 0) {
                lowStockCount++;
            }
        }

        return ReportDto.InventoryValuationReport.builder()
                .warehouseId(warehouseId)
                .warehouseName(whName)
                .totalDistinctProducts(balances.size())
                .totalPhysicalUnits(totalUnits)
                .totalCostValuation(totalCost)
                .totalRetailValuation(totalRetail)
                .lowStockAlertCount(lowStockCount)
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] exportInventoryToExcel(Long warehouseId) {
        List<StockBalance> balances = warehouseId != null
                ? stockBalanceRepository.findByWarehouseId(warehouseId)
                : stockBalanceRepository.findAll();

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Stock Inventory");

            CellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            String[] columns = {"Warehouse", "SKU", "Barcode", "Product Name", "Category", "Quantity", "Unit", "Cost Price", "Selling Price", "Valuation (Cost)", "Status"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (StockBalance sb : balances) {
                Row row = sheet.createRow(rowIdx++);
                BigDecimal qty = sb.getQuantity() != null ? sb.getQuantity() : BigDecimal.ZERO;
                BigDecimal cost = sb.getProduct().getCostPrice() != null ? sb.getProduct().getCostPrice() : BigDecimal.ZERO;

                row.createCell(0).setCellValue(sb.getWarehouse().getName());
                row.createCell(1).setCellValue(sb.getProduct().getSku());
                row.createCell(2).setCellValue(sb.getProduct().getBarcode() != null ? sb.getProduct().getBarcode() : "");
                row.createCell(3).setCellValue(sb.getProduct().getName());
                row.createCell(4).setCellValue(sb.getProduct().getCategory().getName());
                row.createCell(5).setCellValue(qty.doubleValue());
                row.createCell(6).setCellValue(sb.getProduct().getUnitOfMeasure());
                row.createCell(7).setCellValue(cost.doubleValue());
                row.createCell(8).setCellValue(sb.getProduct().getSellingPrice().doubleValue());
                row.createCell(9).setCellValue(qty.multiply(cost).doubleValue());

                int min = sb.getProduct().getMinStockLevel() != null ? sb.getProduct().getMinStockLevel() : 0;
                row.createCell(10).setCellValue(qty.compareTo(BigDecimal.valueOf(min)) <= 0 ? "LOW STOCK" : "NORMAL");
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("Failed to generate Excel inventory export", e);
            throw new RuntimeException("Excel export failure", e);
        }
    }
}
