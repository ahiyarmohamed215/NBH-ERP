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
    private Long assignedStaffId;
    private String assignedStaffName;
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

    // Backward compatibility aliases
    public Long getSalesmanId() {
        return assignedStaffId;
    }

    public String getSalesmanName() {
        return assignedStaffName;
    }

    public static DeliveryRouteDto from(DeliveryRoute r, List<Long> customerIds) {
        Long staffId = r.getAssignedStaff() != null ? r.getAssignedStaff().getId() : null;
        String staffName = r.getAssignedStaff() != null ? r.getAssignedStaff().getFullName() : null;

        return DeliveryRouteDto.builder()
                .id(r.getId())
                .routeCode(r.getRouteCode())
                .routeName(r.getRouteName())
                .description(r.getDescription())
                .area(r.getArea())
                .assignedStaffId(staffId)
                .assignedStaffName(staffName)
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
