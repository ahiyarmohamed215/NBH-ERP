package com.nbh.erp.category.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category extends com.nbh.erp.common.entity.RecyclableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "category_status", length = 20)
    private String status;

    public String getStatus() {
        return status != null ? status : Boolean.TRUE.equals(isActive) ? "ACTIVE" : "INACTIVE";
    }
}
