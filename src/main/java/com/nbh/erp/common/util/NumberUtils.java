package com.nbh.erp.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;

public final class NumberUtils {

    private static final DecimalFormat CURRENCY_FORMAT = new DecimalFormat("#,##0.00");
    private static final DecimalFormat QTY_FORMAT = new DecimalFormat("#,##0.##");

    private NumberUtils() {}

    public static BigDecimal round(BigDecimal value) {
        return value != null ? value.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    public static String formatCurrency(BigDecimal amount) {
        return amount != null ? CURRENCY_FORMAT.format(amount) : "0.00";
    }

    public static String formatQuantity(BigDecimal qty) {
        return qty != null ? QTY_FORMAT.format(qty) : "0";
    }
}
