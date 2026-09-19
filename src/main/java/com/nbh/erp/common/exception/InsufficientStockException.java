package com.nbh.erp.common.exception;

import java.math.BigDecimal;

public class InsufficientStockException extends BusinessException {
    public InsufficientStockException(Long productId, Long warehouseId, BigDecimal available, BigDecimal requested) {
        super(String.format("Insufficient stock for product ID %d in warehouse ID %d. Available: %s, Requested: %s",
                productId, warehouseId, available.toPlainString(), requested.toPlainString()));
    }

    public InsufficientStockException(String message) {
        super(message);
    }
}
