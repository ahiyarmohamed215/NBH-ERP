package com.nbh.erp.customer.dto;

import com.nbh.erp.customer.entity.Customer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
    private Long deliveryRouteId;
    private String deliveryRouteName;
    private String deliveryRouteCode;
    private Long routeId;
    private String routeName;
    private String routeCode;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Boolean getActive() {
        return isActive;
    }

    public static CustomerDto from(Customer c) {
        Long groupId = c.getCustomerGroup() != null ? c.getCustomerGroup().getId() : null;
        String groupName = c.getCustomerGroup() != null ? c.getCustomerGroup().getGroupName() : null;
        String groupCode = c.getCustomerGroup() != null ? c.getCustomerGroup().getGroupCode() : null;

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
                .deliveryRouteId(delRouteId)
                .deliveryRouteName(delRouteName)
                .deliveryRouteCode(delRouteCode)
                .routeId(groupId)
                .routeName(groupName)
                .routeCode(groupCode)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
