package com.nbh.erp.purchaseorder.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
@Entity @Table(name="purchase_orders") @Getter @Setter @NoArgsConstructor
public class PurchaseOrder extends com.nbh.erp.common.entity.BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,unique=true) private String poNumber;
 @ManyToOne(optional=false) private com.nbh.erp.supplier.entity.Supplier supplier;
 @ManyToOne(optional=false) private com.nbh.erp.warehouse.entity.Warehouse warehouse;
 @Column(nullable=false) private LocalDate orderDate;
 private LocalDate expectedDate;
 private String terms;
 @Column(columnDefinition="TEXT") private String notes;
 @Column(nullable=false) private String status="PENDING";
 @Column(nullable=false,precision=15,scale=2) private BigDecimal totalAmount=BigDecimal.ZERO;
 @OneToMany(mappedBy="purchaseOrder",cascade=CascadeType.ALL,orphanRemoval=true)
 private List<PurchaseOrderItem> items=new ArrayList<>();
}
