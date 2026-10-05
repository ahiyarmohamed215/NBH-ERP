package com.nbh.erp.customergroup.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomerGroupRequest {

    private String groupCode;

    private String groupName;

    private String description;

    private Long assignedStaffId;

    private List<Long> customerIds;

    private Boolean isActive;

    // Backward compatibility aliases
    private String routeCode;
    private String routeName;
    private Long salesRepId;

    public String getEffectiveCode() {
        if (StringUtils.hasText(groupCode)) return groupCode;
        if (StringUtils.hasText(routeCode)) return routeCode;
        return null;
    }

    public String getEffectiveName() {
        if (StringUtils.hasText(groupName)) return groupName;
        if (StringUtils.hasText(routeName)) return routeName;
        return "";
    }

    public Long getEffectiveStaffId() {
        if (assignedStaffId != null) return assignedStaffId;
        if (salesRepId != null) return salesRepId;
        return null;
    }
}
