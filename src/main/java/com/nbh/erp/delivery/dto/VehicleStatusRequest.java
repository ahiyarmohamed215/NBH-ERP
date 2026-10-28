package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VehicleStatusRequest(
    @NotBlank(message = "Vehicle status is required")
    @Pattern(regexp = "AVAILABLE|IN_GARAGE|IN_SERVICE|DRAFT|ON_DELIVERY|MAINTENANCE|INACTIVE",
             message = "Status must be AVAILABLE, IN_GARAGE, IN_SERVICE, or DRAFT")
    String status,

    @NotBlank(message = "Status change reason is required")
    @Size(max = 1000, message = "Status change reason must be 1000 characters or fewer")
    String reason
) {}
