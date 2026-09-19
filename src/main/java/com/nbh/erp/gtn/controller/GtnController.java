package com.nbh.erp.gtn.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.gtn.dto.CreateGtnRequest;
import com.nbh.erp.gtn.dto.GtnDto;
import com.nbh.erp.gtn.service.GtnService;
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
@RequestMapping("/api/v1/gtns")
@RequiredArgsConstructor
@Tag(name = "Goods Transfer Note (GTN)", description = "Inter-warehouse stock transfer APIs")
public class GtnController {

    private final GtnService gtnService;

    @GetMapping
    @Operation(summary = "Search GTNs with filters")
    public ResponseEntity<ApiResponse<PagedResponse<GtnDto>>> searchGtns(
            @RequestParam(required = false) Long sourceWarehouseId,
            @RequestParam(required = false) Long destinationWarehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<GtnDto> response = gtnService.searchGtns(sourceWarehouseId, destinationWarehouseId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get GTN details by ID")
    public ResponseEntity<ApiResponse<GtnDto>> getGtnById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(gtnService.getGtnById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Create GTN transfer (pass ?transfer=true to immediately execute transfer)")
    public ResponseEntity<ApiResponse<GtnDto>> createGtn(
            @Valid @RequestBody CreateGtnRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean transfer
    ) {
        GtnDto created = gtnService.createGtn(request, transfer);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("GTN created successfully", created));
    }

    @PostMapping("/{id}/transfer")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Execute transfer between source and destination warehouses")
    public ResponseEntity<ApiResponse<GtnDto>> transferGtn(@PathVariable Long id) {
        GtnDto transferred = gtnService.transferGtn(id);
        return ResponseEntity.ok(ApiResponse.ok("Stock transferred successfully between warehouses", transferred));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Cancel draft GTN")
    public ResponseEntity<ApiResponse<Void>> cancelGtn(@PathVariable Long id) {
        gtnService.cancelGtn(id);
        return ResponseEntity.ok(ApiResponse.ok("GTN cancelled successfully", null));
    }
}
