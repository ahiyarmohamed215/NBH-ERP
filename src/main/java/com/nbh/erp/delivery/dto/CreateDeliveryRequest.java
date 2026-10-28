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

    private Long driverId;

    private Long assistantStaffId;

    private LocalDate scheduledDate;

    private LocalDateTime departureTime;
    private LocalDateTime returnTime;

    private List<Long> invoiceIds;
    private List<Long> specialInvoiceIds;

    private Double startOdometer;
    private Double endOdometer;
    private String gpsTrackingCode;
    private String notes;
    private Boolean isDraft;
    private String status;

    public boolean isDraft() {
        return Boolean.TRUE.equals(isDraft) || "DRAFT".equalsIgnoreCase(status);
    }
}
