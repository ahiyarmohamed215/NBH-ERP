package com.nbh.erp.salesreturn.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.salesreturn.dto.CreateSalesReturnRequest;
import com.nbh.erp.salesreturn.dto.SalesReturnDto;
import com.nbh.erp.salesreturn.service.SalesReturnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sales-returns")
@RequiredArgsConstructor
@Tag(name = "Sales Returns & Credit Notes", description = "Customer returns, inventory restocking, and credit note APIs")
public class SalesReturnController {

    private final SalesReturnService salesReturnService;

    @GetMapping
    @Operation(summary = "Search sales returns with filters")
    public ResponseEntity<ApiResponse<PagedResponse<SalesReturnDto>>> searchSalesReturns(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<SalesReturnDto> response = salesReturnService.searchSalesReturns(warehouseId, customerId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get sales return by ID")
    public ResponseEntity<ApiResponse<SalesReturnDto>> getSalesReturnById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesReturnService.getSalesReturnById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_RETURN')")
    @Operation(summary = "Process a sales return against an invoice (auto restocks restockable items and optionally issues credit note)")
    public ResponseEntity<ApiResponse<SalesReturnDto>> createSalesReturn(@Valid @RequestBody CreateSalesReturnRequest request) {
        SalesReturnDto created = salesReturnService.createSalesReturn(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Sales return processed successfully", created));
    }
}
