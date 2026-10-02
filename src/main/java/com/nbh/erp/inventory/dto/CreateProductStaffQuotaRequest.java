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

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Staff / User ID is required")
    private Long userId;

    private Long warehouseId; // Optional: null means all warehouses

    @NotNull(message = "Allocated quantity is required")
    @Positive(message = "Allocated quantity must be greater than zero")
    private BigDecimal allocatedQuantity;

    private LocalDate validFrom;

    private LocalDate validTo;

    private String notes;
}
