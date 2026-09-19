package com.nbh.erp.warehouse.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.warehouse.dto.CreateWarehouseRequest;
import com.nbh.erp.warehouse.dto.WarehouseDto;
import com.nbh.erp.warehouse.service.WarehouseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
@Tag(name = "Warehouse Management", description = "Warehouse master APIs")
public class WarehouseController {

    private final WarehouseService warehouseService;

    @GetMapping
    @Operation(summary = "List all warehouses")
    public ResponseEntity<ApiResponse<List<WarehouseDto>>> getAllWarehouses() {
        return ResponseEntity.ok(ApiResponse.ok(warehouseService.getAllWarehouses()));
    }

    @GetMapping("/active")
    @Operation(summary = "List active warehouses for selection dropdowns")
    public ResponseEntity<ApiResponse<List<WarehouseDto>>> getActiveWarehouses() {
        return ResponseEntity.ok(ApiResponse.ok(warehouseService.getActiveWarehouses()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get warehouse by ID")
    public ResponseEntity<ApiResponse<WarehouseDto>> getWarehouseById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(warehouseService.getWarehouseById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_MANAGE')")
    @Operation(summary = "Create a new warehouse location")
    public ResponseEntity<ApiResponse<WarehouseDto>> createWarehouse(@Valid @RequestBody CreateWarehouseRequest request) {
        WarehouseDto created = warehouseService.createWarehouse(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Warehouse created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_MANAGE')")
    @Operation(summary = "Update warehouse details")
    public ResponseEntity<ApiResponse<WarehouseDto>> updateWarehouse(
            @PathVariable Long id,
            @Valid @RequestBody CreateWarehouseRequest request
    ) {
        WarehouseDto updated = warehouseService.updateWarehouse(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Warehouse updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_MANAGE')")
    @Operation(summary = "Toggle warehouse active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        warehouseService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Warehouse status updated", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_MANAGE')")
    @Operation(summary = "Delete warehouse")
    public ResponseEntity<ApiResponse<Void>> deleteWarehouse(@PathVariable Long id) {
        warehouseService.deleteWarehouse(id);
        return ResponseEntity.ok(ApiResponse.ok("Warehouse deleted successfully", null));
    }
}
