package com.nbh.erp.supplier.dto;

import com.nbh.erp.supplier.entity.Supplier;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierDto {
    private Long id;
    private String supplierCode;
    private String code;
    private String name;
    private String contactPerson;
    private String phone;
    private String email;
    private String address;
    private Boolean isActive;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;

    public Boolean getActive() {
        return isActive;
    }

    public static SupplierDto from(Supplier s) {
        return SupplierDto.builder()
                .id(s.getId())
                .supplierCode(s.getSupplierCode())
                .code(s.getSupplierCode())
                .name(s.getDisplayName())
                .contactPerson(s.getContactPerson())
                .phone(s.getPhone())
                .email(s.getEmail())
                .address(s.getAddress())
                .isActive(s.getIsActive())
                .status(s.getStatus())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .deletedAt(s.getDeletedAt())
                .build();
    }
}
