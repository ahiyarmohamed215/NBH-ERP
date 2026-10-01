package com.nbh.erp.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDeliveryStatusRequest {
    private LocalDateTime departureTime;
    private LocalDateTime returnTime;
    private Double startOdometer;
    private Double endOdometer;
    private String gpsLastLocation;
    private String cancellationReason;
    private String notes;
}
