package com.nbh.erp.customergroup.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.customergroup.dto.CreateCustomerGroupRequest;
import com.nbh.erp.customergroup.dto.CustomerGroupDto;
import com.nbh.erp.customergroup.service.CustomerGroupService;
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
@RequestMapping({"/api/v1/customer-groups", "/api/v1/routes"})
@RequiredArgsConstructor
@Tag(name = "Customer Groups", description = "Customer grouping and dedicated staff assignment APIs")
public class CustomerGroupController {

    private final CustomerGroupService customerGroupService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get customer groups (defaults to all groups)")
    public ResponseEntity<ApiResponse<List<CustomerGroupDto>>> getAllGroups(
            @RequestParam(required = false, defaultValue = "true") boolean includeInactive
    ) {
        return ResponseEntity.ok(ApiResponse.ok(customerGroupService.getAllGroups(includeInactive)));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get active customer groups")
    public ResponseEntity<ApiResponse<List<CustomerGroupDto>>> getActiveGroups() {
        return ResponseEntity.ok(ApiResponse.ok(customerGroupService.getActiveGroups()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get customer group by ID")
    public ResponseEntity<ApiResponse<CustomerGroupDto>> getGroupById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(customerGroupService.getGroupById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Create a new customer group")
    public ResponseEntity<ApiResponse<CustomerGroupDto>> createGroup(@Valid @RequestBody CreateCustomerGroupRequest request) {
        CustomerGroupDto created = customerGroupService.createGroup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Customer group created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Update an existing customer group")
    public ResponseEntity<ApiResponse<CustomerGroupDto>> updateGroup(
            @PathVariable Long id,
            @Valid @RequestBody CreateCustomerGroupRequest request
    ) {
        CustomerGroupDto updated = customerGroupService.updateGroup(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Customer group updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Toggle active status of customer group")
    public ResponseEntity<ApiResponse<CustomerGroupDto>> toggleActive(@PathVariable Long id) {
        CustomerGroupDto updated = customerGroupService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Customer group status updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Delete (deactivate) a customer group")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        customerGroupService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }
}
