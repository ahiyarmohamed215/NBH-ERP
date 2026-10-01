package com.nbh.erp.delivery.dto;

import com.nbh.erp.delivery.entity.Vehicle;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehicleDto {
    private Long id;
    private String vehicleNumber;
    private String model;
    private String vehicleType;
    private Double capacityKg;
    private String status;
    private Boolean isActive;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static VehicleDto from(Vehicle v) {
        return VehicleDto.builder()
                .id(v.getId())
                .vehicleNumber(v.getVehicleNumber())
                .model(v.getModel())
                .vehicleType(v.getVehicleType())
                .capacityKg(v.getCapacityKg())
                .status(v.getStatus())
                .isActive(v.getIsActive())
                .notes(v.getNotes())
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }
}
