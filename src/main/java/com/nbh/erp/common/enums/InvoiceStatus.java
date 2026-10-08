package com.nbh.erp.common.enums;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum InvoiceStatus {
    HELD,
    SENT_TO_WAREHOUSE,
    STOCK_ADJUSTED,
    COMPLETED,
    PAID,
    PARTIAL,
    VOIDED,
    CANCELLED;

    public static final Set<String> NAMES = Arrays.stream(values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

    public static boolean isValid(String status) {
        return status != null && NAMES.contains(status.trim().toUpperCase());
    }

    public static InvoiceStatus fromString(String status) {
        if (status == null || status.isBlank()) return COMPLETED;
        try {
            return InvoiceStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return COMPLETED;
        }
    }
}
