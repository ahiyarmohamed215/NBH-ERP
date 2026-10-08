package com.nbh.erp.common.entity;
import jakarta.persistence.*;
import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor
public class IdempotencyRecord {
 @Id @Column(length=64) private String requestKey;
 @Column(nullable=false,length=64) private String fingerprint;
 private Long resourceId;
}
