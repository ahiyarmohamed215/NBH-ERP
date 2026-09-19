package com.nbh.erp.stockadjustment.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest;
import com.nbh.erp.stockadjustment.dto.StockAdjustmentDto;
import com.nbh.erp.stockadjustment.service.StockAdjustmentService;
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
@RequestMapping("/api/v1/stock-adjustments")
@RequiredArgsConstructor
@Tag(name = "Stock Adjustment", description = "Audit discrepancy and stock adjustment APIs")
public class StockAdjustmentController {

    private final StockAdjustmentService adjustmentService;

    @GetMapping
    @Operation(summary = "Search stock adjustments with filters")
    public ResponseEntity<ApiResponse<PagedResponse<StockAdjustmentDto>>> searchAdjustments(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<StockAdjustmentDto> response = adjustmentService.searchAdjustments(warehouseId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get stock adjustment by ID")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> getAdjustmentById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(adjustmentService.getAdjustmentById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_ADJUST')")
    @Operation(summary = "Create a stock adjustment (pass ?process=true to auto-adjust inventory immediately)")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> createAdjustment(
            @Valid @RequestBody CreateStockAdjustmentRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean process
    ) {
        StockAdjustmentDto created = adjustmentService.createAdjustment(request, process);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Stock adjustment created successfully", created));
    }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_ADJUST')")
    @Operation(summary = "Process stock adjustment and update warehouse inventory")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> processAdjustment(@PathVariable Long id) {
        StockAdjustmentDto processed = adjustmentService.processAdjustment(id);
        return ResponseEntity.ok(ApiResponse.ok("Stock adjustment processed and inventory synchronized", processed));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_ADJUST')")
    @Operation(summary = "Reject draft stock adjustment")
    public ResponseEntity<ApiResponse<Void>> rejectAdjustment(@PathVariable Long id) {
        adjustmentService.rejectAdjustment(id);
        return ResponseEntity.ok(ApiResponse.ok("Stock adjustment rejected", null));
    }
}
