package com.nbh.erp.warehouse.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "warehouses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warehouse extends com.nbh.erp.common.entity.RecyclableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(length = 30)
    private String phone;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "warehouse_status", length = 20)
    private String status;

    public String getStatus() {
        return status != null ? status : Boolean.TRUE.equals(isActive) ? "ACTIVE" : "INACTIVE";
    }
}
