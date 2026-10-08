package com.nbh.erp.accounting.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor
public class FiscalYear { @Id private Integer fiscalYear; @Column(nullable=false) private boolean closed; }
