package com.nbh.erp.customergroup.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "customer_groups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerGroup extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_code", nullable = false, unique = true, length = 30)
    private String groupCode;

    @Column(name = "group_name", nullable = false, length = 100)
    private String groupName;

    @Column(length = 255)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    // Backward compatibility accessors
    public String getRouteCode() {
        return groupCode;
    }

    public void setRouteCode(String routeCode) {
        this.groupCode = routeCode;
    }

    public String getRouteName() {
        return groupName;
    }

    public void setRouteName(String routeName) {
        this.groupName = routeName;
    }

    public User getSalesRep() {
        return assignedStaff;
    }

    public void setSalesRep(User salesRep) {
        this.assignedStaff = salesRep;
    }
}
