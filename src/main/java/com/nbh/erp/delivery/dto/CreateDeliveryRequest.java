package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeliveryRequest {

    private Long warehouseId;
    private Long routeId;
    private Long vehicleId;

    @NotNull(message = "Primary driver (Staff 1) is required")
    private Long driverId;

    @NotNull(message = "Delivery assistant / helper (Staff 2) is required")
    private Long assistantStaffId;

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    private LocalDateTime departureTime;
    private LocalDateTime returnTime;

    @NotEmpty(message = "At least one sales invoice must be selected for delivery")
    private List<Long> invoiceIds;

    private Double startOdometer;
    private Double endOdometer;
    private String gpsTrackingCode;
    private String notes;
}
