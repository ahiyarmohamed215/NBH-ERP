package com.nbh.erp.customerrange.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCustomerRangeConfigRequest {

    @NotBlank(message = "Range name is required")
    private String name;

    @NotNull(message = "Monthly purchase threshold is required")
    @DecimalMin(value = "0.0", message = "Monthly purchase threshold must be non-negative")
    private BigDecimal minSpend;

    private Integer displayOrder;

    private Boolean isActive;

    private String description;
}
