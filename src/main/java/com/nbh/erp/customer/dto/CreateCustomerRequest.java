package com.nbh.erp.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomerRequest {

    private String customerCode; // Optional: auto-generated if null

    @NotBlank(message = "Customer name is required")
    @Size(min = 2, max = 150)
    private String name;

    private String contactPerson;

    private String phone;

    private String email;

    private String address;

    private BigDecimal creditLimit = BigDecimal.ZERO;

    private Long customerGroupId;

    private Long routeId;

    private List<Long> customerGroupIds;

    private List<Long> routeIds;

    public Long getEffectiveCustomerGroupId() {
        if (customerGroupId != null) return customerGroupId;
        if (routeId != null) return routeId;
        if (customerGroupIds != null && !customerGroupIds.isEmpty()) return customerGroupIds.get(0);
        if (routeIds != null && !routeIds.isEmpty()) return routeIds.get(0);
        return null;
    }

    public List<Long> getEffectiveCustomerGroupIds() {
        if (customerGroupIds != null) {
            return customerGroupIds;
        }
        if (routeIds != null) {
            return routeIds;
        }
        Long singleId = customerGroupId != null ? customerGroupId : routeId;
        if (singleId != null) {
            return List.of(singleId);
        }
        return Collections.emptyList();
    }
}
