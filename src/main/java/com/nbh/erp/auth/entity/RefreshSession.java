package com.nbh.erp.auth.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Getter @Setter @NoArgsConstructor
public class RefreshSession {
 @Id private String id;
 @Column(nullable=false) private String username;
 @Column(nullable=false) private String tokenId;
 @Column(nullable=false) private Instant expiresAt;
 @Column(nullable=false) private long tokenVersion;
}
