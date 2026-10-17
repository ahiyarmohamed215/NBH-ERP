package com.nbh.erp.grn.entity;

import com.nbh.erp.product.entity.Product;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@jakarta.persistence.EntityListeners(com.nbh.erp.realtime.RealtimeEntityListener.class)
@Table(name = "grn_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grn_id", nullable = false)
    private Grn grn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;

    public Warehouse getReceivingWarehouse() {
        return warehouse != null ? warehouse : grn.getWarehouse();
    }

    @Column(name = "quantity_received", nullable = false)
    private BigDecimal quantityReceived;

    @Column(name = "unit_cost", nullable = false)
    private BigDecimal unitCost;

    @Column(name = "total_cost", nullable = false)
    private BigDecimal totalCost;

    @Column(name = "selling_price")
    private BigDecimal sellingPrice;

    @Column(name = "markup_percent", precision = 9, scale = 4)
    private BigDecimal markupPercent;

    @Column(name = "use_brand_markup")
    private Boolean useBrandMarkup;

    @Column(length = 255)
    private String notes;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();
}
