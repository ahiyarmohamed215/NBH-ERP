package com.nbh.erp.inventory.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
public class CreateProductStaffQuotaRequest {

    @jakarta.validation.constraints.Positive
    private Long productId;

    @jakarta.validation.constraints.Positive
    private Long userId;

    @jakarta.validation.constraints.Positive
    private Long warehouseId; // Optional: null means all warehouses

    @Positive(message = "Allowed quantity must be greater than zero")
    @jakarta.validation.constraints.Digits(integer=10,fraction=2)
    private BigDecimal allocatedQuantity;

    private LocalDate validFrom;

    private LocalDate validTo;

    @jakarta.validation.constraints.Size(max = 255)
    private String notes;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;

    @jakarta.validation.constraints.Size(max = 1000)
    private String statusReason;
}
