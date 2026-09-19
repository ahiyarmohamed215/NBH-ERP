package com.nbh.erp.customer.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.customer.dto.CreateCustomerRequest;
import com.nbh.erp.customer.dto.CustomerDto;
import com.nbh.erp.customer.service.CustomerService;
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
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@Tag(name = "Customer Management", description = "Customer master APIs")
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @Operation(summary = "List all customers")
    public ResponseEntity<ApiResponse<List<CustomerDto>>> getAllCustomers() {
        return ResponseEntity.ok(ApiResponse.ok(customerService.getAllCustomers()));
    }

    @GetMapping("/active")
    @Operation(summary = "List active customers")
    public ResponseEntity<ApiResponse<List<CustomerDto>>> getActiveCustomers() {
        return ResponseEntity.ok(ApiResponse.ok(customerService.getActiveCustomers()));
    }

    @GetMapping("/search")
    @Operation(summary = "Search customers by name, code or phone")
    public ResponseEntity<ApiResponse<List<CustomerDto>>> searchCustomers(@RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(ApiResponse.ok(customerService.searchCustomers(query)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get customer by ID")
    public ResponseEntity<ApiResponse<CustomerDto>> getCustomerById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(customerService.getCustomerById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Create a new customer")
    public ResponseEntity<ApiResponse<CustomerDto>> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        CustomerDto created = customerService.createCustomer(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Customer created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Update customer details")
    public ResponseEntity<ApiResponse<CustomerDto>> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody CreateCustomerRequest request
    ) {
        CustomerDto updated = customerService.updateCustomer(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Customer updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Toggle customer active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        customerService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Customer status updated", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Delete a customer")
    public ResponseEntity<ApiResponse<Void>> deleteCustomer(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.ok(ApiResponse.ok("Customer deleted successfully", null));
    }
}
