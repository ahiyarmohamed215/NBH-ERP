package com.nbh.erp.warehouse.dto;

import com.nbh.erp.warehouse.entity.Warehouse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WarehouseDto {
    private Long id;
    private String code;
    private String name;
    private String address;
    private String phone;
    private String contactPerson;
    private Boolean isActive;
    private Boolean isPrimary;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static WarehouseDto from(Warehouse w) {
        return WarehouseDto.builder()
                .id(w.getId())
                .code(w.getCode())
                .name(w.getName())
                .address(w.getAddress())
                .phone(w.getPhone())
                .contactPerson(w.getContactPerson())
                .isActive(w.getIsActive())
                .isPrimary(w.getIsPrimary())
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .build();
    }
}
