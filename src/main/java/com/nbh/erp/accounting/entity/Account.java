package com.nbh.erp.accounting.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor
public class Account extends com.nbh.erp.common.entity.BaseEntity {
 @Id @Column(length=30) private String code;
 @Column(nullable=false) private String name;
 @Column(nullable=false) private String type;
 @Column(nullable=false) private boolean active=true;
}
