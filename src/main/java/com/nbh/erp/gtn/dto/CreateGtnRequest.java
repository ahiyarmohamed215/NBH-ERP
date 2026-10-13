package com.nbh.erp.gtn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateGtnRequest {
    @jakarta.validation.constraints.Size(max=1000)
    private String statusReason;

    @jakarta.validation.constraints.Positive
    private Long sourceWarehouseId;

    @jakarta.validation.constraints.Positive
    private Long destinationWarehouseId;

    @jakarta.validation.constraints.Positive
    private Long responsibleStaffId;

    private String status;

    private LocalDate dispatchDate;

    @jakarta.validation.constraints.Size(max=5000)
    private String notes;

    @NotEmpty(message = "GTN must contain at least one line item")
    @Valid
    private List<CreateGtnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGtnItemRequest {

        @NotNull(message = "Product ID is required")
        @jakarta.validation.constraints.Positive
        private Long productId;

        @jakarta.validation.constraints.Positive
        private Long sourceWarehouseId;
        @jakarta.validation.constraints.Positive
        private Long destinationWarehouseId;

        @NotNull(message = "Transfer quantity is required")
        @Positive(message = "Transfer quantity must be greater than zero")
        @jakarta.validation.constraints.Digits(integer=36,fraction=2,message="Quantity supports up to 2 decimal places")
        private BigDecimal quantityTransferred;

        @jakarta.validation.constraints.Size(max=255)
        private String notes;
    }
}
