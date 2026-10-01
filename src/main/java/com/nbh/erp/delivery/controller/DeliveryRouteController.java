package com.nbh.erp.delivery.controller;

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
    @Operation(summary = "Get all delivery routes")
    public ResponseEntity<ApiResponse<List<DeliveryRouteDto>>> getAllRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getAllRoutes()));
    }

    @GetMapping("/active")
    @Operation(summary = "Get active delivery routes")
    public ResponseEntity<ApiResponse<List<DeliveryRouteDto>>> getActiveRoutes() {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getActiveRoutes()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get delivery route details by ID")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> getRouteById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(routeService.getRouteById(id)));
    }

    @PostMapping
    @Operation(summary = "Create a new delivery route")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> createRoute(@Valid @RequestBody CreateDeliveryRouteRequest req) {
        DeliveryRouteDto created = routeService.createRoute(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Delivery route created successfully", created));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update delivery route details")
    public ResponseEntity<ApiResponse<DeliveryRouteDto>> updateRoute(
            @PathVariable Long id,
            @Valid @RequestBody CreateDeliveryRouteRequest req) {
        DeliveryRouteDto updated = routeService.updateRoute(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Delivery route updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete delivery route")
    public ResponseEntity<ApiResponse<Void>> deleteRoute(@PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.ok(ApiResponse.ok("Delivery route deleted successfully", null));
    }
}
