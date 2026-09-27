package com.nbh.erp.route.dto;

import com.nbh.erp.route.entity.Route;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteDto {
    private Long id;
    private String routeCode;
    private String routeName;
    private String area;
    private String description;
    private Long salesRepId;
    private String salesRepName;
    private String deliveryDays;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static RouteDto from(Route route) {
        if (route == null) return null;
        return RouteDto.builder()
                .id(route.getId())
                .routeCode(route.getRouteCode())
                .routeName(route.getRouteName())
                .area(route.getArea())
                .description(route.getDescription())
                .salesRepId(route.getSalesRep() != null ? route.getSalesRep().getId() : null)
                .salesRepName(route.getSalesRep() != null ? (route.getSalesRep().getFullName() != null ? route.getSalesRep().getFullName() : route.getSalesRep().getUsername()) : null)
                .deliveryDays(route.getDeliveryDays())
                .isActive(route.getIsActive())
                .createdAt(route.getCreatedAt())
                .updatedAt(route.getUpdatedAt())
                .build();
    }
}
