package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateVehicleRequest {

    @NotBlank(message = "Vehicle number is required")
    private String vehicleNumber;

    @NotBlank(message = "Vehicle model is required")
    private String model;

    @Builder.Default
    private String vehicleType = "TRUCK";

    private Double capacityKg;

    @Builder.Default
    private String status = "AVAILABLE";

    private String notes;
}
