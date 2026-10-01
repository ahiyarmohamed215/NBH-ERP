package com.nbh.erp.delivery.dto;

import com.nbh.erp.delivery.entity.DeliveryRoute;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryRouteDto {
    private Long id;
    private String routeCode;
    private String routeName;
    private String description;
    private String area;
    private String startLocation;
    private String endLocation;
    private Integer estimatedDurationMinutes;
    private Double estimatedDistanceKm;
    private String deliveryDays;
    private Boolean isActive;
    private Integer customerCount;
    private List<Long> customerIds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DeliveryRouteDto from(DeliveryRoute r, List<Long> customerIds) {
        return DeliveryRouteDto.builder()
                .id(r.getId())
                .routeCode(r.getRouteCode())
                .routeName(r.getRouteName())
                .description(r.getDescription())
                .area(r.getArea())
                .startLocation(r.getStartLocation())
                .endLocation(r.getEndLocation())
                .estimatedDurationMinutes(r.getEstimatedDurationMinutes())
                .estimatedDistanceKm(r.getEstimatedDistanceKm())
                .deliveryDays(r.getDeliveryDays())
                .isActive(r.getIsActive())
                .customerCount(customerIds != null ? customerIds.size() : 0)
                .customerIds(customerIds != null ? customerIds : List.of())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
