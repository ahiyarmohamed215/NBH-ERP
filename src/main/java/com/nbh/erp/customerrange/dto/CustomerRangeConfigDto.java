package com.nbh.erp.customerrange.dto;

import com.nbh.erp.customerrange.entity.CustomerRangeConfig;
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
public class CustomerRangeConfigDto {
    private Long id;
    private String rangeCode;
    private String name;
    private BigDecimal minSpend;
    private Integer displayOrder;
    private Boolean isActive;
    private String description;
    private long customerCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CustomerRangeConfigDto from(CustomerRangeConfig c, long customerCount) {
        return CustomerRangeConfigDto.builder()
                .id(c.getId())
                .rangeCode(c.getRangeCode())
                .name(c.getName())
                .minSpend(c.getMinSpend())
                .displayOrder(c.getDisplayOrder())
                .isActive(c.getIsActive())
                .description(c.getDescription())
                .customerCount(customerCount)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
