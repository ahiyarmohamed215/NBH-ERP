package com.nbh.erp.customer.dto;

import com.nbh.erp.customer.entity.Customer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDto {
    private Long id;
    private String customerCode;
    private String code;
    private String name;
    private String contactPerson;
    private String phone;
    private String email;
    private String address;
    private BigDecimal creditLimit;
    private BigDecimal currentBalance;
    private Boolean isActive;
    private Long customerGroupId;
    private String customerGroupName;
    private String customerGroupCode;
    private List<Long> customerGroupIds;
    private List<String> customerGroupNames;
    private Long deliveryRouteId;
    private String deliveryRouteName;
    private String deliveryRouteCode;
    private Long routeId;
    private String routeName;
    private String routeCode;
    private List<Long> routeIds;
    private List<String> routeNames;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Boolean getActive() {
        return isActive;
    }

    public static CustomerDto from(Customer c) {
        Set<com.nbh.erp.customergroup.entity.CustomerGroup> rawGroups = c.getCustomerGroups();
        List<com.nbh.erp.customergroup.entity.CustomerGroup> activeGroups = rawGroups != null
                ? rawGroups.stream().filter(g -> Boolean.TRUE.equals(g.getIsActive())).toList()
                : List.of();

        List<Long> groupIds = activeGroups.stream()
                .map(com.nbh.erp.customergroup.entity.CustomerGroup::getId)
                .filter(Objects::nonNull)
                .toList();
        List<String> groupNames = activeGroups.stream()
                .map(com.nbh.erp.customergroup.entity.CustomerGroup::getGroupName)
                .filter(Objects::nonNull)
                .toList();

        com.nbh.erp.customergroup.entity.CustomerGroup activeGroup = (c.getCustomerGroup() != null && Boolean.TRUE.equals(c.getCustomerGroup().getIsActive()))
                ? c.getCustomerGroup()
                : (!activeGroups.isEmpty() ? activeGroups.get(0) : null);

        Long groupId = activeGroup != null ? activeGroup.getId() : null;
        String groupName = activeGroup != null ? activeGroup.getGroupName() : null;
        String groupCode = activeGroup != null ? activeGroup.getGroupCode() : null;

        Long delRouteId = c.getDeliveryRoute() != null ? c.getDeliveryRoute().getId() : null;
        String delRouteName = c.getDeliveryRoute() != null ? c.getDeliveryRoute().getRouteName() : null;
        String delRouteCode = c.getDeliveryRoute() != null ? c.getDeliveryRoute().getRouteCode() : null;

        return CustomerDto.builder()
                .id(c.getId())
                .customerCode(c.getCustomerCode())
                .code(c.getCustomerCode())
                .name(c.getName())
                .contactPerson(c.getContactPerson())
                .phone(c.getPhone())
                .email(c.getEmail())
                .address(c.getAddress())
                .creditLimit(c.getCreditLimit())
                .currentBalance(c.getCurrentBalance())
                .isActive(c.getIsActive())
                .customerGroupId(groupId)
                .customerGroupName(groupName)
                .customerGroupCode(groupCode)
                .customerGroupIds(groupIds)
                .customerGroupNames(groupNames)
                .deliveryRouteId(delRouteId)
                .deliveryRouteName(delRouteName)
                .deliveryRouteCode(delRouteCode)
                .routeId(groupId)
                .routeName(groupName)
                .routeCode(groupCode)
                .routeIds(groupIds)
                .routeNames(groupNames)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
