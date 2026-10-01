package com.nbh.erp.customergroup.dto;

import com.nbh.erp.customergroup.entity.CustomerGroup;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerGroupDto {
    private Long id;
    private String groupCode;
    private String groupName;
    private String description;
    private Long assignedStaffId;
    private String assignedStaffName;
    private Boolean isActive;
    private Integer customerCount;
    private List<Long> customerIds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Backward compatibility aliases
    private String routeCode;
    private String routeName;
    private Long salesRepId;
    private String salesRepName;

    public static CustomerGroupDto from(CustomerGroup group) {
        return from(group, null);
    }

    public static CustomerGroupDto from(CustomerGroup group, List<Long> customerIds) {
        if (group == null) return null;
        Long staffId = group.getAssignedStaff() != null ? group.getAssignedStaff().getId() : null;
        String staffName = group.getAssignedStaff() != null
                ? (group.getAssignedStaff().getFullName() != null
                    ? group.getAssignedStaff().getFullName()
                    : group.getAssignedStaff().getUsername())
                : null;

        List<Long> custIds = customerIds != null ? customerIds : new ArrayList<>();

        return CustomerGroupDto.builder()
                .id(group.getId())
                .groupCode(group.getGroupCode())
                .groupName(group.getGroupName())
                .description(group.getDescription())
                .assignedStaffId(staffId)
                .assignedStaffName(staffName)
                .isActive(group.getIsActive())
                .customerCount(custIds.size())
                .customerIds(custIds)
                .createdAt(group.getCreatedAt())
                .updatedAt(group.getUpdatedAt())
                // Backward compatibility aliases
                .routeCode(group.getGroupCode())
                .routeName(group.getGroupName())
                .salesRepId(staffId)
                .salesRepName(staffName)
                .build();
    }
}
