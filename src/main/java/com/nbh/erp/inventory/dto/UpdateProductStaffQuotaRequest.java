package com.nbh.erp.inventory.dto;

import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProductStaffQuotaRequest {

    @PositiveOrZero(message = "Allocated quantity cannot be negative")
    private BigDecimal allocatedQuantity;

    @PositiveOrZero(message = "Sold quantity cannot be negative")
    private BigDecimal soldQuantity; // For admin adjustments/resets

    private Boolean isActive;

    private LocalDate validFrom;

    private LocalDate validTo;

    private String notes;
}
