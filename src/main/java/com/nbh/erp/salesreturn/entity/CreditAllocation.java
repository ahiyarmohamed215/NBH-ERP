package com.nbh.erp.salesreturn.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
@EntityListeners(com.nbh.erp.realtime.RealtimeEntityListener.class)
public class CreditAllocation {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private CreditNote creditNote;
 @ManyToOne(optional=false) private com.nbh.erp.sales.entity.Invoice invoice;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal amount;
 @Column(nullable=false) private boolean reversed;
}
