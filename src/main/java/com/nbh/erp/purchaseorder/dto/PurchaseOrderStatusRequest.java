package com.nbh.erp.purchaseorder.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PurchaseOrderStatusRequest(@NotBlank String status,
        @NotBlank(message="Status change reason is required") @Size(max=1000) String reason) {}
