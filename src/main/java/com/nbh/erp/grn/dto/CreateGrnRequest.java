package com.nbh.erp.grn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateGrnRequest {
    @jakarta.validation.constraints.Size(max=1000)
    private String statusReason;

    @NotNull(message = "Supplier ID is required")
    @jakarta.validation.constraints.Positive
    private Long supplierId;
    @jakarta.validation.constraints.Positive
    private Long purchaseOrderId;

    @jakarta.validation.constraints.Positive
    private Long warehouseId;

    private String grnType;

    @jakarta.validation.constraints.Size(max=100)
    private String supplierInvoiceNumber;

    @NotNull(message = "Received date is required")
    private LocalDate receivedDate;

    @jakarta.validation.constraints.Size(max=5000)
    private String notes;

    @NotEmpty(message = "GRN must have at least one line item")
    @Valid
    private List<CreateGrnItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGrnItemRequest {

        @NotNull(message = "Product ID is required")
        @jakarta.validation.constraints.Positive
        private Long productId;

        @NotNull(message = "Received quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        @jakarta.validation.constraints.Digits(integer=36,fraction=2,message="Quantity supports up to 2 decimal places")
        private BigDecimal quantityReceived;

        @NotNull(message = "Unit cost is required")
        @PositiveOrZero(message = "Unit cost cannot be negative")
        @jakarta.validation.constraints.Digits(integer=30,fraction=8,message="Unit cost is too large or too precise")
        private BigDecimal unitCost;

        @PositiveOrZero(message = "Selling price cannot be negative")
        @jakarta.validation.constraints.Digits(integer=17,fraction=2)
        private BigDecimal sellingPrice;

        @jakarta.validation.constraints.DecimalMin(value = "-100", message = "MP% cannot be less than -100")
        @jakarta.validation.constraints.DecimalMax("99999")
        private BigDecimal markupPercent;

        private Boolean useBrandMarkup;

        @jakarta.validation.constraints.Size(max=255)
        private String notes;
    }
}
