package com.nbh.erp.delivery.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.delivery.dto.CreateVehicleRequest;
import com.nbh.erp.delivery.dto.VehicleDto;
import com.nbh.erp.delivery.service.VehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/vehicles")
@RequiredArgsConstructor
@Tag(name = "Delivery Vehicles", description = "Fleet and delivery vehicle management APIs")
public class VehicleController {

    private final VehicleService vehicleService;

    @GetMapping
    @Operation(summary = "Get all delivery vehicles")
    public ResponseEntity<ApiResponse<List<VehicleDto>>> getAllVehicles() {
        return ResponseEntity.ok(ApiResponse.ok(vehicleService.getAllVehicles()));
    }

    @GetMapping("/available")
    @Operation(summary = "Get all available active delivery vehicles")
    public ResponseEntity<ApiResponse<List<VehicleDto>>> getAvailableVehicles() {
        return ResponseEntity.ok(ApiResponse.ok(vehicleService.getAvailableVehicles()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get vehicle details by ID")
    public ResponseEntity<ApiResponse<VehicleDto>> getVehicleById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(vehicleService.getVehicleById(id)));
    }

    @PostMapping
    @Operation(summary = "Add a new delivery vehicle")
    public ResponseEntity<ApiResponse<VehicleDto>> createVehicle(@Valid @RequestBody CreateVehicleRequest req) {
        VehicleDto created = vehicleService.createVehicle(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Vehicle registered successfully", created));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update delivery vehicle details")
    public ResponseEntity<ApiResponse<VehicleDto>> updateVehicle(
            @PathVariable Long id,
            @Valid @RequestBody CreateVehicleRequest req) {
        VehicleDto updated = vehicleService.updateVehicle(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Vehicle updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate a delivery vehicle")
    public ResponseEntity<ApiResponse<Void>> deleteVehicle(@PathVariable Long id) {
        vehicleService.deleteVehicle(id);
        return ResponseEntity.ok(ApiResponse.ok("Vehicle deactivated successfully", null));
    }
}
