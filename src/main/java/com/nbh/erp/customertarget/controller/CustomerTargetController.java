package com.nbh.erp.customertarget.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.customertarget.dto.CreateCustomerTargetRequest;
import com.nbh.erp.customertarget.dto.CustomerTargetDto;
import com.nbh.erp.customertarget.dto.CustomerTargetProgressDto;
import com.nbh.erp.customertarget.service.CustomerTargetService;
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
@RequestMapping("/api/v1/customer-targets")
@RequiredArgsConstructor
@Tag(name = "Customer Targets & Ranges", description = "Customer sales target milestones and progressive discount range rules")
public class CustomerTargetController {

    private final CustomerTargetService targetService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW') or hasAuthority('CUSTOMER_TARGET_VIEW') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "List all customer range targets")
    public ResponseEntity<ApiResponse<List<CustomerTargetDto>>> getAllTargets(
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly
    ) {
        return ResponseEntity.ok(ApiResponse.ok(targetService.getAllTargets(activeOnly)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW') or hasAuthority('CUSTOMER_TARGET_VIEW') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Get target by ID with real-time tier metrics")
    public ResponseEntity<ApiResponse<CustomerTargetDto>> getTargetById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(targetService.getTargetById(id)));
    }

    @GetMapping("/customer/{customerId}/progress")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW') or hasAuthority('CUSTOMER_TARGET_VIEW') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Get active target progress and unlocked discount ranges for POS checkout & customer summary")
    public ResponseEntity<ApiResponse<List<CustomerTargetProgressDto>>> getCustomerTargetProgress(
            @PathVariable Long customerId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(targetService.getCustomerTargetProgress(customerId)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE') or hasAuthority('CUSTOMER_TARGET_MANAGE')")
    @Operation(summary = "Create a customer target and discount range rule")
    public ResponseEntity<ApiResponse<CustomerTargetDto>> createTarget(
            @Valid @RequestBody CreateCustomerTargetRequest request
    ) {
        CustomerTargetDto created = targetService.createTarget(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Customer target created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE') or hasAuthority('CUSTOMER_TARGET_MANAGE')")
    @Operation(summary = "Update customer target and range rule")
    public ResponseEntity<ApiResponse<CustomerTargetDto>> updateTarget(
            @PathVariable Long id,
            @Valid @RequestBody CreateCustomerTargetRequest request
    ) {
        CustomerTargetDto updated = targetService.updateTarget(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Customer target updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE') or hasAuthority('CUSTOMER_TARGET_MANAGE')")
    @Operation(summary = "Toggle target active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        targetService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Target active status updated", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE') or hasAuthority('CUSTOMER_TARGET_MANAGE')")
    @Operation(summary = "Deactivate customer target")
    public ResponseEntity<ApiResponse<Void>> deleteTarget(@PathVariable Long id) {
        targetService.deleteTarget(id);
        return ResponseEntity.ok(ApiResponse.ok("Target deactivated successfully", null));
    }
}
