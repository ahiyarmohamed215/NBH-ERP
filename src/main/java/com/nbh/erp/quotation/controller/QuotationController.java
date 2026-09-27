package com.nbh.erp.quotation.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.quotation.dto.CreateQuotationRequest;
import com.nbh.erp.quotation.dto.QuotationDto;
import com.nbh.erp.quotation.service.QuotationService;
import com.nbh.erp.sales.dto.InvoiceDto;
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

@RestController
@RequestMapping("/api/v1/quotations")
@RequiredArgsConstructor
@Tag(name = "Customer Quotations", description = "Quotation management, calculation, and invoice conversion REST APIs")
public class QuotationController {

    private final QuotationService quotationService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_VIEW_ALL') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Search quotations")
    public ResponseEntity<ApiResponse<PagedResponse<QuotationDto>>> searchQuotations(
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<QuotationDto> response = quotationService.searchQuotations(
                customerId, status, startDate, endDate, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_VIEW_ALL') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Get quotation by ID")
    public ResponseEntity<ApiResponse<QuotationDto>> getQuotationById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.getQuotationById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Create quotation with backend number generation and calculations")
    public ResponseEntity<ApiResponse<QuotationDto>> createQuotation(@Valid @RequestBody CreateQuotationRequest request) {
        QuotationDto quotation = quotationService.createQuotation(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Quotation created successfully", quotation));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Update existing quotation")
    public ResponseEntity<ApiResponse<QuotationDto>> updateQuotation(
            @PathVariable Long id,
            @Valid @RequestBody CreateQuotationRequest request
    ) {
        QuotationDto quotation = quotationService.updateQuotation(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Quotation updated successfully", quotation));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Delete quotation")
    public ResponseEntity<ApiResponse<Void>> deleteQuotation(@PathVariable Long id) {
        quotationService.deleteQuotation(id);
        return ResponseEntity.ok(ApiResponse.ok("Quotation deleted successfully", null));
    }

    @PostMapping("/{id}/convert-to-invoice")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Convert accepted quotation to commercial invoice")
    public ResponseEntity<ApiResponse<InvoiceDto>> convertToInvoice(
            @PathVariable Long id,
            @RequestParam(required = false) Long warehouseId
    ) {
        InvoiceDto invoice = quotationService.convertToInvoice(id, warehouseId);
        return ResponseEntity.ok(ApiResponse.ok("Quotation converted to commercial invoice successfully", invoice));
    }
}
