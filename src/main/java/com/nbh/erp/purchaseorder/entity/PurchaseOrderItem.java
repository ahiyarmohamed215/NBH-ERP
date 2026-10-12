package com.nbh.erp.purchaseorder.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
public class PurchaseOrderItem {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private PurchaseOrder purchaseOrder;
 @ManyToOne(optional=false) private com.nbh.erp.product.entity.Product product;
 @ManyToOne @JoinColumn(name="warehouse_id") private com.nbh.erp.warehouse.entity.Warehouse warehouse;
 @ManyToOne @JoinColumn(name="supplier_id") private com.nbh.erp.supplier.entity.Supplier supplier;
 public com.nbh.erp.supplier.entity.Supplier getOrderingSupplier() { return supplier!=null ? supplier : purchaseOrder.getSupplier(); }
 public com.nbh.erp.warehouse.entity.Warehouse getDeliveryWarehouse() { return warehouse!=null ? warehouse : purchaseOrder.getWarehouse(); }
 @Column(nullable=false,precision=15,scale=3) private BigDecimal quantity;
 @Column(nullable=false,precision=15,scale=3) private BigDecimal receivedQuantity=BigDecimal.ZERO;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal unitCost;
}
