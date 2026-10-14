package com.nbh.erp.brand.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "brands")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Brand extends com.nbh.erp.common.entity.RecyclableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "markup_percent", nullable = false, precision = 9, scale = 4)
    @Builder.Default
    private java.math.BigDecimal markupPercent = java.math.BigDecimal.ZERO;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "brand_status", length = 20)
    private String status;

    public String getStatus() {
        return status != null ? status : Boolean.TRUE.equals(isActive) ? "ACTIVE" : "INACTIVE";
    }
}
