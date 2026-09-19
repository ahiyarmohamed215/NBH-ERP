package com.nbh.erp.salesman.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.salesman.dto.CreateSalesmanRequest;
import com.nbh.erp.salesman.dto.SalesmanDto;
import com.nbh.erp.salesman.service.SalesmanService;
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
@RequestMapping("/api/v1/salesmen")
@RequiredArgsConstructor
@Tag(name = "Salesman Management", description = "Sales representatives master APIs")
public class SalesmanController {

    private final SalesmanService salesmanService;

    @GetMapping
    @Operation(summary = "List all salesmen")
    public ResponseEntity<ApiResponse<List<SalesmanDto>>> getAllSalesmen() {
        return ResponseEntity.ok(ApiResponse.ok(salesmanService.getAllSalesmen()));
    }

    @GetMapping("/active")
    @Operation(summary = "List active salesmen for invoice selection")
    public ResponseEntity<ApiResponse<List<SalesmanDto>>> getActiveSalesmen() {
        return ResponseEntity.ok(ApiResponse.ok(salesmanService.getActiveSalesmen()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get salesman by ID")
    public ResponseEntity<ApiResponse<SalesmanDto>> getSalesmanById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesmanService.getSalesmanById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Create a new salesman")
    public ResponseEntity<ApiResponse<SalesmanDto>> createSalesman(@Valid @RequestBody CreateSalesmanRequest request) {
        SalesmanDto created = salesmanService.createSalesman(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Salesman created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Update salesman details")
    public ResponseEntity<ApiResponse<SalesmanDto>> updateSalesman(
            @PathVariable Long id,
            @Valid @RequestBody CreateSalesmanRequest request
    ) {
        SalesmanDto updated = salesmanService.updateSalesman(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Salesman updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Toggle salesman active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        salesmanService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Salesman status updated", null));
    }
}
