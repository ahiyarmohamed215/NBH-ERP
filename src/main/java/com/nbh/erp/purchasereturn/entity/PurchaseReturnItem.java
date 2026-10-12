package com.nbh.erp.purchasereturn.entity;

import com.nbh.erp.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "prn_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseReturnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prn_id", nullable = false)
    private PurchaseReturn purchaseReturn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_grn_id")
    private com.nbh.erp.grn.entity.Grn sourceGrn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    private com.nbh.erp.warehouse.entity.Warehouse warehouse;

    public Long getOriginalGrnId() { return sourceGrn != null ? sourceGrn.getId() : purchaseReturn.getSourceGrnId(); }
    public com.nbh.erp.warehouse.entity.Warehouse getReturnWarehouse() { return warehouse != null ? warehouse : purchaseReturn.getWarehouse(); }
    public com.nbh.erp.supplier.entity.Supplier getReturnSupplier() { return sourceGrn != null ? sourceGrn.getSupplier() : purchaseReturn.getSupplier(); }

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "quantity_returned", nullable = false)
    private BigDecimal quantityReturned;

    @Column(name = "unit_cost", nullable = false)
    private BigDecimal unitCost;

    @Column(name = "total_cost", nullable = false)
    private BigDecimal totalCost;

    @Column(length = 255)
    private String reason;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();
}
