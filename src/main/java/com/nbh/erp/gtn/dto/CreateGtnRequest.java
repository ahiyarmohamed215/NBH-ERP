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

    @NotNull(message = "Source warehouse ID is required")
    private Long sourceWarehouseId;

    @NotNull(message = "Destination warehouse ID is required")
    private Long destinationWarehouseId;

    private LocalDate dispatchDate;

    private String notes;

    @NotEmpty(message = "GTN must contain at least one line item")
    @Valid
    private List<CreateGtnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGtnItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Transfer quantity is required")
        @Positive(message = "Transfer quantity must be greater than zero")
        private BigDecimal quantityTransferred;

        private String notes;
    }
}
