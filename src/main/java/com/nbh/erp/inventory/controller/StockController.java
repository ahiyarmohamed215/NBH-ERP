package com.nbh.erp.inventory.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.inventory.dto.StockDto;
import com.nbh.erp.inventory.dto.StockMovementDto;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.inventory.repository.StockMovementRepository;
import com.nbh.erp.inventory.service.StockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@Tag(name = "Inventory & Stock Ledger", description = "Central Stock engine query and ledger audit APIs")
public class StockController {

    private final StockService stockService;
    private final StockBalanceRepository stockBalanceRepository;
    private final StockMovementRepository stockMovementRepository;

    @GetMapping("/balances")
    @Operation(summary = "Search current stock balances across warehouses")
    public ResponseEntity<ApiResponse<PagedResponse<StockDto>>> getBalances(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<StockDto> page = stockBalanceRepository.searchBalances(warehouseId, query, pageable).map(StockDto::from);
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
        List<StockDto> list = (warehouseId != null
                ? stockBalanceRepository.findLowStockInWarehouse(warehouseId)
                : stockBalanceRepository.findAllLowStock())
                .stream()
                .map(StockDto::from)
                .collect(Collectors.toList());

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
        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime endDateTime = endDate != null ? endDate.atTime(23, 59, 59) : null;

        Page<StockMovementDto> page = stockMovementRepository
                .findLedger(warehouseId, productId, movementType, startDateTime, endDateTime, pageable)
                .map(StockMovementDto::from);

        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(page)));
    }
}
