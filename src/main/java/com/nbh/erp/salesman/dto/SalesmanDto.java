package com.nbh.erp.salesman.dto;

import com.nbh.erp.salesman.entity.Salesman;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalesmanDto {
    private Long id;
    private String salesmanCode;
    private String name;
    private String phone;
    private String email;
    private BigDecimal commissionRate;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SalesmanDto from(Salesman s) {
        return SalesmanDto.builder()
                .id(s.getId())
                .salesmanCode(s.getSalesmanCode())
                .name(s.getName())
                .phone(s.getPhone())
                .email(s.getEmail())
                .commissionRate(s.getCommissionRate())
                .isActive(s.getIsActive())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
