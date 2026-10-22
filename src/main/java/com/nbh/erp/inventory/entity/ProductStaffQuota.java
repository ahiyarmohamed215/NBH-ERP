package com.nbh.erp.inventory.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Product Sales Quota / POS Staff Allocation
 * Restricts the maximum quantity of a product a specific sales rep or POS staff member can sell,
 * preventing team conflicts and ensuring fair distribution of high-demand inventory.
 */
@Entity
@Table(name = "product_staff_quotas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductStaffQuota extends com.nbh.erp.common.entity.RecyclableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user; // Staff / Sales rep with POS access

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse; // Optional: if null, applies across all warehouses

    @Column(name = "allocated_quantity", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal allocatedQuantity = BigDecimal.ZERO;

    @Column(name = "sold_quantity", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal soldQuantity = BigDecimal.ZERO;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "allocation_status", length = 20)
    private String allocationStatus;

    public String getAllocationStatus() {
        return "CANCELLED".equals(allocationStatus) ? "INACTIVE" : allocationStatus != null ? allocationStatus : Boolean.TRUE.equals(isActive) ? "ACTIVE" : "INACTIVE";
    }

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(length = 255)
    private String notes;

    @Transient
    public BigDecimal getRemainingQuantity() {
        BigDecimal alloc = allocatedQuantity != null ? allocatedQuantity : BigDecimal.ZERO;
        BigDecimal sold = soldQuantity != null ? soldQuantity : BigDecimal.ZERO;
        BigDecimal rem = alloc.subtract(sold);
        return rem.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : rem;
    }

    @Transient
    public boolean isExhausted() {
        return getRemainingQuantity().compareTo(BigDecimal.ZERO) <= 0;
    }
}
