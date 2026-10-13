package com.nbh.erp.purchasereturn.dto;

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
public class CreatePurchaseReturnRequest {
    @jakarta.validation.constraints.Size(max=1000)
    private String statusReason;

    @jakarta.validation.constraints.Positive
    private Long supplierId;
    @jakarta.validation.constraints.Positive
    private Long sourceGrnId;

    @jakarta.validation.constraints.Positive
    private Long warehouseId;

    @NotNull(message = "Return date is required")
    private LocalDate returnDate;

    @jakarta.validation.constraints.Size(max=255)
    private String reason;
    @jakarta.validation.constraints.Size(max=5000)
    private String remarks;

    @NotEmpty(message = "Purchase return must contain at least one line item")
    @Valid
    private List<CreatePurchaseReturnItemRequest> items;

    @jakarta.validation.constraints.AssertTrue(message="Enter a return reason of 1–255 characters for each item")
    public boolean isReturnReasonsValid() {
        return items==null || items.stream().allMatch(item->{String value=item.getReason()!=null?item.getReason():reason;return value!=null && !value.isBlank() && value.trim().length()<=255;});
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePurchaseReturnItemRequest {

        @NotNull(message = "Product ID is required")
        @jakarta.validation.constraints.Positive
        private Long productId;

        @NotNull(message = "Return quantity is required")
        @Positive(message = "Quantity must be greater than zero")
        @jakarta.validation.constraints.Digits(integer=36,fraction=2,message="Quantity supports up to 2 decimal places")
        private BigDecimal quantityReturned;

        @NotNull(message = "Unit cost is required")
        @jakarta.validation.constraints.PositiveOrZero(message = "Unit cost cannot be negative")
        @jakarta.validation.constraints.Digits(integer=32,fraction=6,message="Unit cost is too large or too precise")
        private BigDecimal unitCost;

        @jakarta.validation.constraints.Size(max=255)
        private String reason;
        @jakarta.validation.constraints.Positive
        private Long sourceGrnId;
        @jakarta.validation.constraints.Positive
        private Long warehouseId;
        @jakarta.validation.constraints.Size(max=5000)
        private String remarks;
    }
}
