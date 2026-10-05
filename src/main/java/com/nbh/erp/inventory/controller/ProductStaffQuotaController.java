package com.nbh.erp.inventory.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.inventory.dto.*;
import com.nbh.erp.inventory.service.ProductStaffQuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/inventory/staff-quotas")
@RequiredArgsConstructor
@Tag(name = "Inventory Allocation", description = "Inventory allocation and product limits for sales staff and POS cashiers")
public class ProductStaffQuotaController {

    private final ProductStaffQuotaService quotaService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_VIEW') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Search product staff quotas with filters")
    public ResponseEntity<ApiResponse<PagedResponse<ProductStaffQuotaDto>>> searchQuotas(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Boolean activeOnly,
            @RequestParam(required = false) String query,
            @PageableDefault(sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<ProductStaffQuotaDto> page = quotaService.searchQuotas(productId, userId, warehouseId, activeOnly, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(page)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_VIEW')")
    @Operation(summary = "Get high-level quota metrics and allocation overview")
    public ResponseEntity<ApiResponse<QuotaSummaryDto>> getSummaryMetrics() {
        return ResponseEntity.ok(ApiResponse.ok(quotaService.getSummaryMetrics()));
    }

    @GetMapping("/check")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_VIEW') or hasAuthority('SALES_CREATE')")
    @Operation(summary = "Check remaining quota limit for staff member and product before billing")
    public ResponseEntity<ApiResponse<QuotaCheckResultDto>> checkStaffQuota(
            @RequestParam Long productId,
            @RequestParam Long userId,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) BigDecimal requestedQuantity
    ) {
        QuotaCheckResultDto result = quotaService.checkStaffProductQuota(productId, userId, warehouseId, requestedQuantity);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_VIEW')")
    @Operation(summary = "Get a specific quota allocation by ID")
    public ResponseEntity<ApiResponse<ProductStaffQuotaDto>> getQuotaById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotaService.getQuotaById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_MANAGE')")
    @Operation(summary = "Create or allocate selling limit to a sales rep / POS staff member")
    public ResponseEntity<ApiResponse<ProductStaffQuotaDto>> createOrUpdateQuota(
            @Valid @RequestBody CreateProductStaffQuotaRequest request
    ) {
        ProductStaffQuotaDto created = quotaService.createOrUpdateQuota(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("POS Staff quota allocated successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_MANAGE')")
    @Operation(summary = "Update an existing staff quota allocation")
    public ResponseEntity<ApiResponse<ProductStaffQuotaDto>> updateQuota(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductStaffQuotaRequest request
    ) {
        ProductStaffQuotaDto updated = quotaService.updateQuota(id, request);
        return ResponseEntity.ok(ApiResponse.ok("POS Staff quota updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_MANAGE')")
    @Operation(summary = "Delete a staff quota allocation")
    public ResponseEntity<ApiResponse<Void>> deleteQuota(@PathVariable Long id) {
        quotaService.deleteQuota(id);
        return ResponseEntity.ok(ApiResponse.ok("Staff quota allocation deleted successfully", null));
    }
}
