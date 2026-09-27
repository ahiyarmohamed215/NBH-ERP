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
    private Long routeId;
    private String routeName;
    private String routeCode;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Boolean getActive() {
        return isActive;
    }

    public static CustomerDto from(Customer c) {
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
                .routeId(c.getRoute() != null ? c.getRoute().getId() : null)
                .routeName(c.getRoute() != null ? c.getRoute().getRouteName() : null)
                .routeCode(c.getRoute() != null ? c.getRoute().getRouteCode() : null)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
