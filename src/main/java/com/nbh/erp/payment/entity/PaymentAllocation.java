package com.nbh.erp.payment.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
public class PaymentAllocation extends com.nbh.erp.common.entity.BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private Payment payment;
 @ManyToOne(optional=false) private com.nbh.erp.sales.entity.Invoice invoice;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal amount;
 @Column(nullable=false) private boolean reversed;
}
