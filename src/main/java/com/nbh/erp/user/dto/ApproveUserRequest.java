package com.nbh.erp.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApproveUserRequest {

    // Roles are optional: staff who don't access ERP can be approved without system roles
    private List<String> roles;
    private String fullName;
    private String email;
    private String phone;
    private String employeeCode;
}
