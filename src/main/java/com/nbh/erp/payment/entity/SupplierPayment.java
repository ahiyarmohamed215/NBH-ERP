package com.nbh.erp.payment.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
@Entity @Getter @Setter @NoArgsConstructor
public class SupplierPayment extends com.nbh.erp.common.entity.BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private com.nbh.erp.grn.entity.Grn grn;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal amount;
 @Column(nullable=false) private LocalDate paymentDate;
 @Column(nullable=false) private String method;
 @Column(nullable=false) private boolean reversed;
}
