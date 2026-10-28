package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateVehicleRequest {

    @jakarta.validation.constraints.Size(max = 50)
    private String vehicleNumber;

    @jakarta.validation.constraints.Size(max = 100)
    private String model;

    private String vehicleType;

    private Double capacityKg;

    private Long assignedStaffId;

    private boolean draft;

    @Builder.Default
    private String status = "AVAILABLE";

    private String notes;
}
