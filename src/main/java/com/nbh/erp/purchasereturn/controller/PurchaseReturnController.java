package com.nbh.erp.purchasereturn.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest;
import com.nbh.erp.purchasereturn.dto.PurchaseReturnDto;
import com.nbh.erp.purchasereturn.service.PurchaseReturnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/purchase-returns")
@RequiredArgsConstructor
@Tag(name = "Purchase Return Note (PRN)", description = "Supplier returns & stock deduction APIs")
public class PurchaseReturnController {

    private final PurchaseReturnService purchaseReturnService;

    @GetMapping("/return-sources")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('PRN_PROCESS') or hasAuthority('PRN_VIEW')")
    public ResponseEntity<ApiResponse<java.util.List<PurchaseReturnService.ReturnSource>>> getReturnSources() {
        return ResponseEntity.ok(ApiResponse.ok(purchaseReturnService.getReturnSources()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('PRN_PROCESS')")
    public ResponseEntity<ApiResponse<PurchaseReturnDto>> updatePurchaseReturn(@PathVariable Long id,
            @Valid @RequestBody CreatePurchaseReturnRequest request, @RequestParam(defaultValue = "false") boolean process) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseReturnService.updatePurchaseReturn(id, request, process)));
    }

    @GetMapping
    @Operation(summary = "Search purchase returns with filters")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseReturnDto>>> searchPurchaseReturns(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<PurchaseReturnDto> response = purchaseReturnService.searchPurchaseReturns(warehouseId, supplierId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get purchase return details by ID")
    public ResponseEntity<ApiResponse<PurchaseReturnDto>> getPurchaseReturnById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseReturnService.getPurchaseReturnById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('PRN_PROCESS')")
    @Operation(summary = "Create a purchase return (pass ?process=true to immediately process and decrease stock)")
    public ResponseEntity<ApiResponse<PurchaseReturnDto>> createPurchaseReturn(
            @Valid @RequestBody CreatePurchaseReturnRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean process
    ) {
        PurchaseReturnDto created = purchaseReturnService.createPurchaseReturn(request, process);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Purchase return created successfully", created));
    }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('PRN_PROCESS')")
    @Operation(summary = "Process or reprocess purchase return and decrease warehouse inventory")
    public ResponseEntity<ApiResponse<PurchaseReturnDto>> processPurchaseReturn(@PathVariable Long id, @Valid @RequestBody com.nbh.erp.common.dto.StatusChangeRequest request) {
        PurchaseReturnDto processed = purchaseReturnService.processPurchaseReturn(id, request.reason());
        return ResponseEntity.ok(ApiResponse.ok("Purchase return processed and inventory deducted", processed));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('PRN_PROCESS')")
    @Operation(summary = "Cancel purchase return and restore processed inventory")
    public ResponseEntity<ApiResponse<PurchaseReturnDto>> cancelPurchaseReturn(@PathVariable Long id, @Valid @RequestBody com.nbh.erp.common.dto.StatusChangeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Purchase return cancelled successfully", purchaseReturnService.cancelPurchaseReturn(id, request.reason())));
    }
}
