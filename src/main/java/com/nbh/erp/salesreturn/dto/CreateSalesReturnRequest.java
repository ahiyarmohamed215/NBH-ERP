package com.nbh.erp.salesreturn.dto;

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
public class CreateSalesReturnRequest {

    @NotNull(message = "Invoice ID is required")
    private Long invoiceId;

    private String returnType = "REFUND"; // REFUND, CREDIT_NOTE, RESTOCK

    private LocalDate returnDate;

    private String reason;

    @NotEmpty(message = "Sales return must contain at least one item")
    @Valid
    private List<CreateSalesReturnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateSalesReturnItemRequest {

        private Long invoiceItemId;

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        private BigDecimal quantity;

        @NotNull(message = "Unit price is required")
        private BigDecimal unitPrice;

        private String conditionType = "RESTOCKABLE"; // RESTOCKABLE, DAMAGED
    }
}
