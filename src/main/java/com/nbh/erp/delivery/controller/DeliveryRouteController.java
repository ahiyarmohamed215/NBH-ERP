package com.nbh.erp.delivery.controller;
import org.springframework.security.access.prepost.PreAuthorize;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.delivery.dto.CreateDeliveryRouteRequest;
import com.nbh.erp.delivery.dto.DeliveryRouteDto;
import com.nbh.erp.delivery.service.DeliveryRouteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/delivery-routes")
@RequiredArgsConstructor
@Tag(name = "Delivery Routes", description = "Distribution delivery routes & customer territory assignment APIs")
public class DeliveryRouteController {

    private final DeliveryRouteService routeService;

    @GetMapping
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('DELIVERY')")
    @Operation(summary = "Get all delivery routes")
    public ResponseEntity<ApiResponse<List<DeliveryRouteDto>>> getAllRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getAllRoutes()));
    }

    @GetMapping("/active")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('DELIVERY') or T(com.nbh.erp.security.SecurityUtils).canRead('SALES')")
    @Operation(summary = "Get active delivery routes")
    public ResponseEntity<ApiResponse<List<DeliveryRouteDto>>> getActiveRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getActiveRoutes()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('DELIVERY')")
    @Operation(summary = "Get delivery route details by ID")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> getRouteById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getRouteById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','DELIVERY_MANAGE')")
    @Operation(summary = "Create a new delivery route")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> createRoute(@Valid @RequestBody CreateDeliveryRouteRequest req) {
        DeliveryRouteDto created = routeService.createRoute(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Delivery route created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','DELIVERY_MANAGE')")
    @Operation(summary = "Update delivery route details")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> updateRoute(
            @PathVariable Long id,
            @Valid @RequestBody CreateDeliveryRouteRequest req) {
        DeliveryRouteDto updated = routeService.updateRoute(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Delivery route updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','DELIVERY_MANAGE')")
    @Operation(summary = "Delete delivery route")
    public ResponseEntity<ApiResponse<Void>> deleteRoute(@PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.ok(ApiResponse.ok("Delivery route deleted successfully", null));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','DELIVERY_MANAGE')")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(routeService.toggleActive(id)));
    }

    public record RouteStatusRequest(@jakarta.validation.constraints.Pattern(regexp="ACTIVE|INACTIVE") @jakarta.validation.constraints.NotBlank String status,
                                     @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason) {}

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','DELIVERY_MANAGE')")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> changeStatus(@PathVariable Long id, @Valid @RequestBody RouteStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(routeService.changeStatus(id, request.status(), request.reason())));
    }
}
