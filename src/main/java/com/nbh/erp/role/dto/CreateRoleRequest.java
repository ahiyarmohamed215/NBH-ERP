package com.nbh.erp.role.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoleRequest {

    @NotBlank(message = "Role name is required")
    private String name;

    private String description;

    private String status;

    private List<String> permissions;

    public CreateRoleRequest(String name, String description, List<String> permissions) {
        this.name = name;
        this.description = description;
        this.status = "ACTIVE";
        this.permissions = permissions;
    }
}
