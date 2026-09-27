package com.nbh.erp.route.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.route.dto.CreateRouteRequest;
import com.nbh.erp.route.dto.RouteDto;
import com.nbh.erp.route.service.RouteService;
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
@RequestMapping("/api/v1/routes")
@RequiredArgsConstructor
@Tag(name = "Customer Routes", description = "Delivery route and sales rep territory planning APIs")
public class RouteController {

    private final RouteService routeService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get all delivery routes")
    public ResponseEntity<ApiResponse<List<RouteDto>>> getAllRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getAllRoutes()));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get active delivery routes")
    public ResponseEntity<ApiResponse<List<RouteDto>>> getActiveRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getActiveRoutes()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_VIEW')")
    @Operation(summary = "Get delivery route by ID")
    public ResponseEntity<ApiResponse<RouteDto>> getRouteById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getRouteById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Create a new delivery route")
    public ResponseEntity<ApiResponse<RouteDto>> createRoute(@Valid @RequestBody CreateRouteRequest request) {
        RouteDto created = routeService.createRoute(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Route created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Update an existing delivery route")
    public ResponseEntity<ApiResponse<RouteDto>> updateRoute(
            @PathVariable Long id,
            @Valid @RequestBody CreateRouteRequest request
    ) {
        RouteDto updated = routeService.updateRoute(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Route updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Toggle active status of route")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        routeService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Route status updated successfully", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_MANAGE')")
    @Operation(summary = "Delete (deactivate) a route")
    public ResponseEntity<Void> deleteRoute(@PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }
}
