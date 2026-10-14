package com.nbh.erp.supplier.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.supplier.dto.CreateSupplierRequest;
import com.nbh.erp.supplier.dto.SupplierDto;
import com.nbh.erp.supplier.service.SupplierService;
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
@RequestMapping("/api/v1/suppliers")
@RequiredArgsConstructor
@Tag(name = "Supplier Management", description = "Supplier master APIs")
public class SupplierController {

    private final SupplierService supplierService;

    @GetMapping
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SUPPLIER')")
    @Operation(summary = "List all suppliers")
    public ResponseEntity<ApiResponse<List<SupplierDto>>> getAllSuppliers() {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.getAllSuppliers()));
    }

    @GetMapping("/active")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SUPPLIER')")
    @Operation(summary = "List active suppliers for purchase dropdowns")
    public ResponseEntity<ApiResponse<List<SupplierDto>>> getActiveSuppliers() {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.getActiveSuppliers()));
    }

    @GetMapping("/search")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SUPPLIER')")
    @Operation(summary = "Search suppliers by name or code")
    public ResponseEntity<ApiResponse<List<SupplierDto>>> searchSuppliers(@RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.searchSuppliers(query)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SUPPLIER')")
    @Operation(summary = "Get supplier by ID")
    public ResponseEntity<ApiResponse<SupplierDto>> getSupplierById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.getSupplierById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    @Operation(summary = "Create a new supplier")
    public ResponseEntity<ApiResponse<SupplierDto>> createSupplier(@Valid @RequestBody CreateSupplierRequest request) {
        SupplierDto created = supplierService.createSupplier(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Supplier created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    @Operation(summary = "Update supplier details")
    public ResponseEntity<ApiResponse<SupplierDto>> updateSupplier(
            @PathVariable Long id,
            @Valid @RequestBody CreateSupplierRequest request
    ) {
        SupplierDto updated = supplierService.updateSupplier(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Supplier updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    @Operation(summary = "Toggle supplier active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id, @Valid @RequestBody com.nbh.erp.common.dto.StatusChangeRequest request) {
        supplierService.toggleActive(id, request.reason());
        return ResponseEntity.ok(ApiResponse.ok("Supplier status updated", null));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    public ResponseEntity<ApiResponse<SupplierDto>> changeStatus(@PathVariable Long id,@Valid @RequestBody com.nbh.erp.supplier.dto.SupplierStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Supplier status updated",supplierService.changeStatus(id,request.status(),request.reason())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    @Operation(summary = "Delete a supplier")
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        supplierService.deleteSupplier(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recycle-bin")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    public ResponseEntity<ApiResponse<List<SupplierDto>>> recycleBin() {
        return ResponseEntity.ok(ApiResponse.ok(supplierService.getRecycleBin()));
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    public ResponseEntity<ApiResponse<SupplierDto>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Supplier restored", supplierService.restoreSupplier(id)));
    }

    @DeleteMapping("/{id}/permanent")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('SUPPLIER_MANAGE')")
    public ResponseEntity<Void> permanentlyDelete(@PathVariable Long id) {
        supplierService.permanentlyDeleteSupplier(id);
        return ResponseEntity.noContent().build();
    }
}
