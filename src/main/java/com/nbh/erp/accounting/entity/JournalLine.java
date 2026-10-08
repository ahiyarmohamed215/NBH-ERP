package com.nbh.erp.accounting.entity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
public class JournalLine {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) private Journal journal;
 @ManyToOne(optional=false) private Account account;
 @Column(nullable=false,precision=19,scale=2) private BigDecimal debit=BigDecimal.ZERO;
 @Column(nullable=false,precision=19,scale=2) private BigDecimal credit=BigDecimal.ZERO;
}
