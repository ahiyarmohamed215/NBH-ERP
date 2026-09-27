package com.nbh.erp.common.enums;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum PaymentMethod {
    CASH,
    CARD,
    BANK_TRANSFER,
    CHEQUE,
    ONLINE;

    public static final Set<String> NAMES = Arrays.stream(values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

    public static boolean isValid(String method) {
        if (method == null) return false;
        String normalized = method.trim().toUpperCase().replace(" ", "_");
        return NAMES.contains(normalized);
    }

    public static PaymentMethod fromString(String method) {
        if (method == null || method.isBlank()) return CASH;
        try {
            return PaymentMethod.valueOf(method.trim().toUpperCase().replace(" ", "_"));
        } catch (IllegalArgumentException e) {
            return CASH;
        }
    }
}
