package com.nbh.erp.sales.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.sales.dto.CashierAccountingDto;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Sales & Invoicing", description = "Point of Sale, Billing, and Held Carts APIs")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping
    @Operation(summary = "Search sales invoices with date, warehouse, customer, and cashier filters")
    public ResponseEntity<ApiResponse<PagedResponse<InvoiceDto>>> searchInvoices(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String cashier,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<InvoiceDto> response = invoiceService.searchInvoices(
                warehouseId, customerId, status, paymentType, startDate, endDate, cashier, query, pageable
        );
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/held")
    @Operation(summary = "Get list of held sales invoices (isolated per cashier for regular sales staff)")
    public ResponseEntity<ApiResponse<List<InvoiceDto>>> getHeldInvoices(
            @RequestParam(required = false) String cashier
    ) {
        return ResponseEntity.ok(ApiResponse.ok(invoiceService.getHeldInvoices(cashier)));
    }

    @GetMapping("/accounting/cashiers")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_VIEW_ALL')")
    @Operation(summary = "Get per-cashier sales and held billing accounting breakdown")
    public ResponseEntity<ApiResponse<List<CashierAccountingDto>>> getCashierAccounting(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        List<CashierAccountingDto> accounting = invoiceService.getCashierAccounting(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(accounting));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get invoice by ID")
    public ResponseEntity<ApiResponse<InvoiceDto>> getInvoiceById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(invoiceService.getInvoiceById(id)));
    }

    @GetMapping("/number/{number}")
    @Operation(summary = "Get invoice by invoice number (e.g. INV-2026-000001)")
    public ResponseEntity<ApiResponse<InvoiceDto>> getInvoiceByNumber(@PathVariable String number) {
        return ResponseEntity.ok(ApiResponse.ok(invoiceService.getInvoiceByNumber(number)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Complete a POS sale or place invoice on hold")
    public ResponseEntity<ApiResponse<InvoiceDto>> createInvoice(@Valid @RequestBody CreateInvoiceRequest request) {
        InvoiceDto created = invoiceService.createInvoice(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Invoice created successfully", created));
    }

    @PostMapping("/held/{id}/resume")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Resume and complete a held sales invoice")
    public ResponseEntity<ApiResponse<InvoiceDto>> resumeHeldInvoice(
            @PathVariable Long id,
            @Valid @RequestBody CreateInvoiceRequest request
    ) {
        InvoiceDto completed = invoiceService.resumeHeldInvoice(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Held invoice completed successfully", completed));
    }

    @PostMapping("/held/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Discard/cancel a held sales invoice")
    public ResponseEntity<ApiResponse<Void>> cancelHeldInvoice(@PathVariable Long id) {
        invoiceService.cancelHeldInvoice(id);
        return ResponseEntity.ok(ApiResponse.ok("Held invoice discarded", null));
    }
}

