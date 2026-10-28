package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleDeliveryRequest {

    @NotNull(message = "New scheduled date is required")
    private LocalDate newScheduledDate;

    @NotBlank(message = "Reason for rescheduling is required")
    private String reason;

    private String notes;
}
