package com.nbh.erp.purchaseorder.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
public class PurchaseOrderItem {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private PurchaseOrder purchaseOrder;
 @ManyToOne(optional=false) private com.nbh.erp.product.entity.Product product;
 @Column(nullable=false,precision=15,scale=3) private BigDecimal quantity;
 @Column(nullable=false,precision=15,scale=3) private BigDecimal receivedQuantity=BigDecimal.ZERO;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal unitCost;
}
