package com.nbh.erp.inventory.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.inventory.dto.StockDto;
import com.nbh.erp.inventory.dto.StockMovementDto;
import com.nbh.erp.inventory.service.StockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_VIEW')")
@Tag(name = "Inventory & Stock Ledger", description = "Central Stock engine query and ledger audit APIs")
public class StockController {

    private final StockService stockService;

    @GetMapping("/balances")
    @Operation(summary = "Search current stock balances across warehouses")
    public ResponseEntity<ApiResponse<PagedResponse<StockDto>>> getBalances(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<StockDto> page = stockService.searchBalances(warehouseId, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(page)));
    }

    @GetMapping("/warehouse/{warehouseId}")
    @Operation(summary = "Get all product stock balances in a specific warehouse")
    public ResponseEntity<ApiResponse<List<StockDto>>> getStockByWarehouse(@PathVariable Long warehouseId) {
        return ResponseEntity.ok(ApiResponse.ok(stockService.getStockByWarehouse(warehouseId)));
    }

    @GetMapping("/warehouse/{warehouseId}/product/{productId}")
    @Operation(summary = "Get current stock for a specific product in a warehouse")
    public ResponseEntity<ApiResponse<StockDto>> getProductStock(
            @PathVariable Long warehouseId,
            @PathVariable Long productId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(stockService.getStockBalance(warehouseId, productId)));
    }

    @GetMapping("/low-stock")
    @Operation(summary = "List all inventory items currently at or below reorder level")
    public ResponseEntity<ApiResponse<List<StockDto>>> getLowStock(
            @RequestParam(required = false) Long warehouseId
    ) {
        List<StockDto> list = stockService.findLowStock(warehouseId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/ledger")
    @Operation(summary = "Query the chronological stock movement ledger audit trail")
    public ResponseEntity<ApiResponse<PagedResponse<StockMovementDto>>> getStockLedger(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String movementType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        Page<StockMovementDto> page = stockService.getLedger(warehouseId, productId, movementType, startDate, endDate, pageable);
        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(page)));
    }
}
