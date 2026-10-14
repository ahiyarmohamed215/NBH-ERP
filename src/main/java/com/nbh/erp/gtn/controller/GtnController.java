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

    @GetMapping("/responsible-staff")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('GTN')")
    public ResponseEntity<ApiResponse<java.util.List<GtnService.ResponsibleStaff>>> responsibleStaff() {
        return ResponseEntity.ok(ApiResponse.ok(gtnService.getResponsibleStaff()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    public ResponseEntity<ApiResponse<GtnDto>> updateGtn(@PathVariable Long id, @Valid @RequestBody CreateGtnRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(gtnService.updateGtn(id, request)));
    }

    public record DispatchRequest(Long responsibleStaffId, @jakarta.validation.constraints.NotBlank String reason) {}
    @PostMapping("/{id}/dispatch")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    public ResponseEntity<ApiResponse<GtnDto>> dispatchGtn(@PathVariable Long id, @Valid @RequestBody DispatchRequest request) {
        var gtn = gtnService.getGtnById(id);
        if (request.responsibleStaffId() != null && !request.responsibleStaffId().equals(gtn.getResponsibleStaffId())) throw new com.nbh.erp.common.exception.BusinessException("Use Edit to change responsible staff");
        return ResponseEntity.ok(ApiResponse.ok(gtnService.changeStatus(id, "PENDING", request.reason(), false)));
    }

    public record TransferConfirmation(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.AssertTrue Boolean signedCopyReceived, @jakarta.validation.constraints.NotBlank String reason) {}

    public record StatusChange(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp="PENDING|TRANSFERRED|CANCELLED") String status,
                               @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason,
                               Boolean signedCopyReceived) {}
    @PostMapping("/{id}/status")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    public ResponseEntity<ApiResponse<GtnDto>> changeStatus(@PathVariable Long id, @Valid @RequestBody StatusChange request) {
        return ResponseEntity.ok(ApiResponse.ok(gtnService.changeStatus(id, request.status(), request.reason(), Boolean.TRUE.equals(request.signedCopyReceived()))));
    }

    @GetMapping
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('GTN')")
    @Operation(summary = "Search GTNs with filters")
    public ResponseEntity<ApiResponse<PagedResponse<GtnDto>>> searchGtns(
            @RequestParam(required = false) Long sourceWarehouseId,
            @RequestParam(required = false) Long destinationWarehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20, sort = {"createdAt", "id"}, direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable
    ) {
        PagedResponse<GtnDto> response = gtnService.searchGtns(sourceWarehouseId, destinationWarehouseId, status, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('GTN')")
    @Operation(summary = "Get GTN details by ID")
    public ResponseEntity<ApiResponse<GtnDto>> getGtnById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(gtnService.getGtnById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Create a draft or pending GTN without moving inventory")
    public ResponseEntity<ApiResponse<GtnDto>> createGtn(
            @Valid @RequestBody CreateGtnRequest request,
            @RequestParam(required = false, defaultValue = "false") boolean transfer
    ) {
        GtnDto created = gtnService.createGtn(request, transfer);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("GTN created successfully", created));
    }

    @PostMapping("/{id}/transfer")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Process or reprocess transfer between source and destination warehouses")
    public ResponseEntity<ApiResponse<GtnDto>> transferGtn(@PathVariable Long id, @Valid @RequestBody TransferConfirmation confirmation) {
        GtnDto transferred = gtnService.changeStatus(id, "TRANSFERRED", confirmation.reason(), confirmation.signedCopyReceived());
        return ResponseEntity.ok(ApiResponse.ok("Stock transferred successfully between warehouses", transferred));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('GTN_PROCESS')")
    @Operation(summary = "Cancel GTN and reverse completed stock transfer")
    public ResponseEntity<ApiResponse<GtnDto>> cancelGtn(@PathVariable Long id, @Valid @RequestBody StatusChange request) {
        return ResponseEntity.ok(ApiResponse.ok("GTN cancelled successfully", gtnService.changeStatus(id, "CANCELLED", request.reason(), false)));
    }
}
