package com.nbh.erp.grn.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.grn.dto.CreateGrnRequest;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.service.GrnService;
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
@RequestMapping("/api/v1/grns")
@RequiredArgsConstructor
@Tag(name = "Goods Received Note (GRN)", description = "Supplier delivery intake & inventory receipt APIs")
public class GrnController {

    private final GrnService grnService;

    @GetMapping
    @Operation(summary = "Search GRNs with filters")
    public ResponseEntity<ApiResponse<PagedResponse<GrnDto>>> searchGrns(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<GrnDto> response = grnService.searchGrns(warehouseId, supplierId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get GRN details with line items by ID")
    public ResponseEntity<ApiResponse<GrnDto>> getGrnById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(grnService.getGrnById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GRN_PROCESS')")
    @Operation(summary = "Create a new Goods Received Note (pass ?process=true to auto-process and increase stock)")
    public ResponseEntity<ApiResponse<GrnDto>> createGrn(
            @Valid @RequestBody CreateGrnRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean process
    ) {
        GrnDto created = grnService.createGrn(request, process);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("GRN created successfully", created));
    }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GRN_PROCESS')")
    @Operation(summary = "Process draft GRN and increment warehouse stock balances")
    public ResponseEntity<ApiResponse<GrnDto>> processGrn(@PathVariable Long id) {
        GrnDto processed = grnService.processGrn(id);
        return ResponseEntity.ok(ApiResponse.ok("GRN processed and inventory updated", processed));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GRN_PROCESS')")
    @Operation(summary = "Cancel an un-processed draft GRN")
    public ResponseEntity<ApiResponse<Void>> cancelGrn(@PathVariable Long id) {
        grnService.cancelGrn(id);
        return ResponseEntity.ok(ApiResponse.ok("GRN cancelled successfully", null));
    }
}
