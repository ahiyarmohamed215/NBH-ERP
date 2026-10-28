package com.nbh.erp.delivery.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "vehicles", indexes = {
        @Index(name = "idx_veh_number", columnList = "vehicle_number"),
        @Index(name = "idx_veh_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehicle extends com.nbh.erp.common.entity.RecyclableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vehicle_number", unique = true, length = 50)
    private String vehicleNumber; // e.g. WP-CAB-4821

    @Column(length = 100)
    private String model; // e.g. Isuzu Elf 4-Ton Truck

    @Column(name = "vehicle_type", length = 50)
    @Builder.Default
    private String vehicleType = "LORRY"; // LORRY, TRUCK, THREEWHEEL, VAN

    @Column(name = "capacity_kg")
    private Double capacityKg;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private com.nbh.erp.user.entity.User assignedStaff;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "AVAILABLE"; // AVAILABLE, ON_DELIVERY, MAINTENANCE, INACTIVE

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
