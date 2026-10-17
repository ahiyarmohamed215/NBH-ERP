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
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('STOCK_ADJUSTMENT')")
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

    @GetMapping("/products")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    public ApiResponse<?> searchProducts(@RequestParam(defaultValue="") String query){return ApiResponse.ok(adjustmentService.searchProducts(query));}

    @GetMapping("/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('STOCK_ADJUSTMENT')")
    @Operation(summary = "Get stock adjustment by ID")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> getAdjustmentById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(adjustmentService.getAdjustmentById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    @Operation(summary = "Create a stock adjustment (pass ?process=true to auto-adjust inventory immediately)")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> createAdjustment(
            @Valid @RequestBody CreateStockAdjustmentRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean process
    ) {
        StockAdjustmentDto created = adjustmentService.createAdjustment(request, process);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Stock adjustment created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    public ApiResponse<StockAdjustmentDto> updateDraft(@PathVariable Long id, @Valid @RequestBody CreateStockAdjustmentRequest request,
            @RequestParam(defaultValue="false") boolean process) {
        return ApiResponse.ok(adjustmentService.updateDraft(id,request,process));
    }

    public record CancelRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason) {}

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    public ApiResponse<StockAdjustmentDto> cancel(@PathVariable Long id,@Valid @RequestBody CancelRequest request) {
        return ApiResponse.ok(adjustmentService.cancelAdjustment(id,request.reason()));
    }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    @Operation(summary = "Process stock adjustment and update warehouse inventory")
    public ResponseEntity<ApiResponse<StockAdjustmentDto>> processAdjustment(@PathVariable Long id, @Valid @RequestBody(required=false) CancelRequest request) {
        StockAdjustmentDto processed = adjustmentService.processAdjustment(id, request==null?null:request.reason());
        return ResponseEntity.ok(ApiResponse.ok("Stock adjustment processed and inventory synchronized", processed));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','INVENTORY_ADJUST')")
    @Operation(summary = "Reject draft stock adjustment")
    public ResponseEntity<ApiResponse<Void>> rejectAdjustment(@PathVariable Long id) {
        adjustmentService.rejectAdjustment(id);
        return ResponseEntity.ok(ApiResponse.ok("Stock adjustment rejected", null));
    }
}
