package com.nbh.erp.customer.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_code", nullable = false, unique = true, length = 20)
    private String customerCode;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(length = 30)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "credit_limit", nullable = false)
    @Builder.Default
    private BigDecimal creditLimit = BigDecimal.ZERO;

    @Column(name = "current_balance", nullable = false)
    @Builder.Default
    private BigDecimal currentBalance = BigDecimal.ZERO;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "customer_group_mappings",
            joinColumns = @JoinColumn(name = "customer_id"),
            inverseJoinColumns = @JoinColumn(name = "group_id")
    )
    @Builder.Default
    private Set<com.nbh.erp.customergroup.entity.CustomerGroup> customerGroups = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_group_id")
    private com.nbh.erp.customergroup.entity.CustomerGroup customerGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_route_id")
    private com.nbh.erp.delivery.entity.DeliveryRoute deliveryRoute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private com.nbh.erp.user.entity.User assignedStaff;

    public com.nbh.erp.user.entity.User getEffectiveAssignedStaff() {
        if (this.assignedStaff != null) {
            return this.assignedStaff;
        }
        if (this.customerGroup != null && this.customerGroup.getAssignedStaff() != null) {
            return this.customerGroup.getAssignedStaff();
        }
        if (this.deliveryRoute != null && this.deliveryRoute.getAssignedStaff() != null) {
            return this.deliveryRoute.getAssignedStaff();
        }
        return null;
    }

    public Set<com.nbh.erp.customergroup.entity.CustomerGroup> getCustomerGroups() {
        if (this.customerGroups == null) {
            this.customerGroups = new HashSet<>();
        }
        if (this.customerGroups.isEmpty() && this.customerGroup != null) {
            this.customerGroups.add(this.customerGroup);
        }
        return this.customerGroups;
    }

    // Backward compatibility accessors
    public com.nbh.erp.customergroup.entity.CustomerGroup getRoute() {
        return customerGroup;
    }

    public void setRoute(com.nbh.erp.customergroup.entity.CustomerGroup group) {
        this.customerGroup = group;
    }
}
