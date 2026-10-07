package com.nbh.erp.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductStockAvailabilityDto {

    private Long productId;
    private String productName;
    private String productSku;
    private Long warehouseId;
    private BigDecimal availableStock;
    private BigDecimal totalEnterpriseStock;
    private boolean outOfStock;
}
