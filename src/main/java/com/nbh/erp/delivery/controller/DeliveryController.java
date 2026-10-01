package com.nbh.erp.delivery.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.delivery.dto.CreateDeliveryRequest;
import com.nbh.erp.delivery.dto.DeliveryDto;
import com.nbh.erp.delivery.dto.DeliverySummaryDto;
import com.nbh.erp.delivery.dto.UpdateDeliveryStatusRequest;
import com.nbh.erp.delivery.service.DeliveryService;
import com.nbh.erp.sales.dto.InvoiceDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/deliveries")
@RequiredArgsConstructor
@Tag(name = "Delivery & Distribution", description = "Delivery dispatches, vehicle trips, staff assignment, and lifecycle management APIs")
public class DeliveryController {

    private final DeliveryService deliveryService;

    @GetMapping
    @Operation(summary = "Search and list delivery trips")
    public ResponseEntity<ApiResponse<List<DeliveryDto>>> searchDeliveries(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long routeId,
            @RequestParam(required = false) Long vehicleId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.ok(
                deliveryService.searchDeliveries(status, routeId, vehicleId, startDate, endDate, search)
        ));
    }

    @GetMapping("/summary")
    @Operation(summary = "Get delivery KPI metrics summary")
    public ResponseEntity<ApiResponse<DeliverySummaryDto>> getSummaryMetrics() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.getSummaryMetrics()));
    }

    @GetMapping("/pending-invoices")
    @Operation(summary = "Get completed sales invoices available to be loaded for delivery")
    public ResponseEntity<ApiResponse<List<InvoiceDto>>> getPendingInvoicesForDelivery() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.getPendingInvoicesForDelivery()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get delivery trip details with manifest of assigned invoices")
    public ResponseEntity<ApiResponse<DeliveryDto>> getDeliveryById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.getDeliveryById(id)));
    }

    @PostMapping
    @Operation(summary = "Create and schedule a new delivery trip")
    public ResponseEntity<ApiResponse<DeliveryDto>> createDelivery(@Valid @RequestBody CreateDeliveryRequest req) {
        DeliveryDto created = deliveryService.createDelivery(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Delivery trip scheduled successfully", created));
    }

    @PostMapping("/{id}/dispatch")
    @Operation(summary = "Dispatch vehicle on route (records departure time and marks In Transit)")
    public ResponseEntity<ApiResponse<DeliveryDto>> dispatchDelivery(
            @PathVariable Long id,
            @RequestBody(required = false) UpdateDeliveryStatusRequest req) {
        DeliveryDto dispatched = deliveryService.dispatchDelivery(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Vehicle dispatched on route", dispatched));
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Complete delivery trip (records return time, calculates trip duration, marks invoices delivered)")
    public ResponseEntity<ApiResponse<DeliveryDto>> completeDelivery(
            @PathVariable Long id,
            @RequestBody(required = false) UpdateDeliveryStatusRequest req) {
        DeliveryDto completed = deliveryService.completeDelivery(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Delivery trip completed and invoices delivered", completed));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel delivery trip and restore invoices to pending status")
    public ResponseEntity<ApiResponse<DeliveryDto>> cancelDelivery(
            @PathVariable Long id,
            @RequestBody(required = false) UpdateDeliveryStatusRequest req) {
        DeliveryDto cancelled = deliveryService.cancelDelivery(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Delivery trip cancelled", cancelled));
    }
}
