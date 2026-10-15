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

    @PositiveOrZero(message = "Allowed quantity cannot be negative")
    @jakarta.validation.constraints.Digits(integer=10,fraction=2)
    private BigDecimal allocatedQuantity;

    @PositiveOrZero(message = "Sold quantity cannot be negative")
    private BigDecimal soldQuantity; // For admin adjustments/resets

    private Boolean isActive;

    @jakarta.validation.constraints.Positive
    private Long productId;
    @jakarta.validation.constraints.Positive
    private Long userId;
    private Boolean replaceDraftFields;

    private LocalDate validFrom;

    private LocalDate validTo;

    @jakarta.validation.constraints.Size(max = 255)
    private String notes;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;

    @jakarta.validation.constraints.Size(max = 1000)
    private String statusReason;
}
