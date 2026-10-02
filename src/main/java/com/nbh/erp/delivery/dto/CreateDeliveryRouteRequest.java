package com.nbh.erp.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeliveryRouteRequest {

    private String routeCode;

    @NotBlank(message = "Route name is required")
    private String routeName;

    private String description;
    private String area;
    private Long assignedStaffId;
    private String startLocation;
    private String endLocation;
    private Integer estimatedDurationMinutes;
    private Double estimatedDistanceKm;
    private String deliveryDays;
    private List<Long> customerIds;

    // Helper for salesmanId alias
    public Long getEffectiveStaffId() {
        return assignedStaffId;
    }
}
