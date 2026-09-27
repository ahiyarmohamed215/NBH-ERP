package com.nbh.erp.common.enums;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum PurchaseOrderStatus {
    DRAFT,
    SUBMITTED,
    APPROVED,
    PARTIALLY_RECEIVED,
    COMPLETED,
    CANCELLED;

    public static final Set<String> NAMES = Arrays.stream(values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

    public static boolean isValid(String status) {
        return status != null && NAMES.contains(status.trim().toUpperCase());
    }

    public static PurchaseOrderStatus fromString(String status) {
        if (status == null || status.isBlank()) return DRAFT;
        try {
            return PurchaseOrderStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DRAFT;
        }
    }
}
