package com.nbh.erp.inventory.dto;

import com.nbh.erp.inventory.entity.ProductStaffQuota;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductStaffQuotaDto {

    private Long id;

    // Product info
    private Long productId;
    private String productSku;
    private String productName;
    private String productBarcode;
    private String productUnit;
    private BigDecimal currentStockInWarehouse;
    private BigDecimal totalStockAvailable;

    // Staff / User info
    private Long userId;
    private String username;
    private String userFullName;
    private String userEmployeeCode;

    // Warehouse info
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;

    // Quota metrics
    private BigDecimal allocatedQuantity;
    private BigDecimal soldQuantity;
    private BigDecimal remainingQuantity;
    private Double utilizationPercentage;

    private Boolean isActive;
    private String status; // ACTIVE, EXHAUSTED, INACTIVE
    private LocalDate validFrom;
    private LocalDate validTo;
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ProductStaffQuotaDto fromEntity(ProductStaffQuota q, BigDecimal stock) {
        return fromEntity(q, stock, stock);
    }

    public static ProductStaffQuotaDto fromEntity(ProductStaffQuota q, BigDecimal totalStock, BigDecimal currentStock) {
        if (q == null) return null;

        BigDecimal alloc = q.getAllocatedQuantity() != null ? q.getAllocatedQuantity() : BigDecimal.ZERO;
        BigDecimal sold = q.getSoldQuantity() != null ? q.getSoldQuantity() : BigDecimal.ZERO;
        BigDecimal rem = q.getRemainingQuantity();

        double util = 0.0;
        if (alloc.compareTo(BigDecimal.ZERO) > 0) {
            util = Math.min(100.0, sold.doubleValue() / alloc.doubleValue() * 100.0);
        }

        String statusStr;
        if (!Boolean.TRUE.equals(q.getIsActive())) {
            statusStr = "INACTIVE";
        } else if (rem.compareTo(BigDecimal.ZERO) <= 0) {
            statusStr = "EXHAUSTED";
        } else {
            statusStr = "ACTIVE";
        }

        BigDecimal totStock = totalStock != null ? totalStock : (currentStock != null ? currentStock : BigDecimal.ZERO);

        return ProductStaffQuotaDto.builder()
                .id(q.getId())
                .productId(q.getProduct() != null ? q.getProduct().getId() : null)
                .productSku(q.getProduct() != null ? q.getProduct().getSku() : null)
                .productName(q.getProduct() != null ? q.getProduct().getName() : null)
                .productBarcode(q.getProduct() != null ? q.getProduct().getBarcode() : null)
                .productUnit(q.getProduct() != null ? q.getProduct().getUnitOfMeasure() : null)
                .currentStockInWarehouse(currentStock != null ? currentStock : BigDecimal.ZERO)
                .totalStockAvailable(totStock)
                .userId(q.getUser() != null ? q.getUser().getId() : null)
                .username(q.getUser() != null ? q.getUser().getUsername() : null)
                .userFullName(q.getUser() != null ? q.getUser().getFullName() : null)
                .userEmployeeCode(q.getUser() != null ? q.getUser().getEmployeeCode() : null)
                .warehouseId(q.getWarehouse() != null ? q.getWarehouse().getId() : null)
                .warehouseCode(q.getWarehouse() != null ? q.getWarehouse().getCode() : "ALL")
                .warehouseName(q.getWarehouse() != null ? q.getWarehouse().getName() : "All Warehouses")
                .allocatedQuantity(alloc)
                .soldQuantity(sold)
                .remainingQuantity(rem)
                .utilizationPercentage(Math.round(util * 10.0) / 10.0)
                .isActive(q.getIsActive())
                .status(statusStr)
                .validFrom(q.getValidFrom())
                .validTo(q.getValidTo())
                .notes(q.getNotes())
                .createdAt(q.getCreatedAt())
                .updatedAt(q.getUpdatedAt())
                .build();
    }
}
