package com.nbh.erp.delivery.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "delivery_routes", indexes = {
        @Index(name = "idx_del_route_code", columnList = "route_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryRoute extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "route_code", nullable = false, unique = true, length = 30)
    private String routeCode; // e.g. DR-001

    @Column(name = "route_name", nullable = false, length = 100)
    private String routeName; // e.g. Colombo - Western Corridor

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String area; // e.g. Western Province

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    @Column(name = "start_location", length = 150)
    private String startLocation; // e.g. Central Warehouse

    @Column(name = "end_location", length = 150)
    private String endLocation; // e.g. Negombo Depot

    @Column(name = "estimated_duration_minutes")
    private Integer estimatedDurationMinutes;

    @Column(name = "estimated_distance_km")
    private Double estimatedDistanceKm;

    @Column(name = "delivery_days", length = 100)
    private String deliveryDays; // e.g. Monday, Wednesday, Friday

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @OneToMany(mappedBy = "deliveryRoute")
    @Builder.Default
    private List<Customer> customers = new ArrayList<>();
}
