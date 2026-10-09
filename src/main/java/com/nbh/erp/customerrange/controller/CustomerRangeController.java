package com.nbh.erp.customerrange.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.customerrange.dto.*;
import com.nbh.erp.customerrange.service.CustomerRangeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/customer-ranges")
@RequiredArgsConstructor
public class CustomerRangeController {

    private final CustomerRangeService customerRangeService;

    // =========================================================================
    // 1. Range Configuration Endpoints (Admin / Settings)
    // =========================================================================

    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerRangeConfigDto>>> getAllRanges() {
        List<CustomerRangeConfigDto> ranges = customerRangeService.getAllRanges();
        return ResponseEntity.ok(ApiResponse.ok(ranges));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CUSTOMER_TARGET_MANAGE') or hasAuthority('CUSTOMER_MANAGE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerRangeConfigDto>> createRange(
            @Valid @RequestBody CreateCustomerRangeConfigRequest request) {
        CustomerRangeConfigDto dto = customerRangeService.createRange(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CUSTOMER_TARGET_MANAGE') or hasAuthority('CUSTOMER_MANAGE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerRangeConfigDto>> updateRange(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomerRangeConfigRequest request) {
        CustomerRangeConfigDto dto = customerRangeService.updateRange(id, request);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('CUSTOMER_TARGET_MANAGE') or hasAuthority('CUSTOMER_MANAGE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerRangeConfigDto>> toggleStatus(
            @PathVariable Long id,
            @RequestParam boolean active) {
        CustomerRangeConfigDto dto = customerRangeService.toggleRangeStatus(id, active);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/audit-trail")
    @PreAuthorize("hasAuthority('CUSTOMER_TARGET_MANAGE') or hasAuthority('CUSTOMER_MANAGE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RangeAuditLogDto>>> getAuditTrail() {
        List<RangeAuditLogDto> logs = customerRangeService.getAuditLogs();
        return ResponseEntity.ok(ApiResponse.ok(logs));
    }

    // =========================================================================
    // 2. Customer Progress & POS Cart Projection Endpoints
    // =========================================================================

    @GetMapping("/customer/{customerId}/progress")
    public ResponseEntity<ApiResponse<CustomerMonthlyProgressDto>> getCustomerProgress(
            @PathVariable Long customerId,
            @RequestParam(required = false) BigDecimal cartTotal) {
        CustomerMonthlyProgressDto dto = customerRangeService.getCustomerProgress(customerId, cartTotal);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/customer/{customerId}/history")
    public ResponseEntity<ApiResponse<List<CustomerRangeHistoryDto>>> getCustomerRangeHistory(
            @PathVariable Long customerId) {
        List<CustomerRangeHistoryDto> history = customerRangeService.getCustomerRangeHistory(customerId);
        return ResponseEntity.ok(ApiResponse.ok(history));
    }

    // =========================================================================
    // 3. Sales Staff Dashboard: "My Customer Targets"
    // =========================================================================

    @GetMapping("/my-targets")
    public ResponseEntity<ApiResponse<Page<StaffCustomerTargetDto>>> getMyCustomerTargets(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long rangeId,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("qualifyingPurchases").descending());
        Page<StaffCustomerTargetDto> result = customerRangeService.getMyCustomerTargets(search, rangeId, sort, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/near-target")
    public ResponseEntity<ApiResponse<List<StaffCustomerTargetDto>>> getMyCustomersNearTarget() {
        List<StaffCustomerTargetDto> list = customerRangeService.getMyCustomersNearTarget();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    // =========================================================================
    // 4. Manager Dashboard & Staff Performance
    // =========================================================================

    @GetMapping("/manager-dashboard")
    public ResponseEntity<ApiResponse<ManagerRangeDashboardDto>> getManagerDashboard(
            @RequestParam(required = false) String yearMonth,
            @RequestParam(required = false) Long staffId,
            @RequestParam(required = false) Long rangeId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("qualifyingPurchases").descending());
        ManagerRangeDashboardDto dto = customerRangeService.getManagerDashboard(yearMonth, staffId, rangeId, search, pageable);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/staff-performance")
    public ResponseEntity<ApiResponse<List<StaffPerformanceDto>>> getStaffPerformance(
            @RequestParam(required = false) String yearMonth) {
        List<StaffPerformanceDto> report = customerRangeService.getStaffPerformanceReport(yearMonth);
        return ResponseEntity.ok(ApiResponse.ok(report));
    }
}
