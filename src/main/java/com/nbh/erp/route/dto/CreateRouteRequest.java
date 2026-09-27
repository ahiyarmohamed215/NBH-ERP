package com.nbh.erp.route.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRouteRequest {

    private String routeCode;

    @NotBlank(message = "Route name is required")
    private String routeName;

    private String area;

    private String description;

    private Long salesRepId;

    private String deliveryDays;
}
