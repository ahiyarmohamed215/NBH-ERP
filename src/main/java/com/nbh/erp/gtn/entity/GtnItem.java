package com.nbh.erp.gtn.entity;

import com.nbh.erp.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "gtn_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GtnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gtn_id", nullable = false)
    private Gtn gtn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_warehouse_id")
    private com.nbh.erp.warehouse.entity.Warehouse sourceWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_warehouse_id")
    private com.nbh.erp.warehouse.entity.Warehouse destinationWarehouse;

    public com.nbh.erp.warehouse.entity.Warehouse getTransferSource() {
        return sourceWarehouse != null ? sourceWarehouse : gtn.getSourceWarehouse();
    }
    public com.nbh.erp.warehouse.entity.Warehouse getTransferDestination() {
        return destinationWarehouse != null ? destinationWarehouse : gtn.getDestinationWarehouse();
    }

    @Column(name = "quantity_transferred", nullable = false)
    private BigDecimal quantityTransferred;

    @Column(name = "unit_cost", nullable = false)
    @Builder.Default
    private BigDecimal unitCost = BigDecimal.ZERO;

    @Column(length = 255)
    private String notes;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();
}
