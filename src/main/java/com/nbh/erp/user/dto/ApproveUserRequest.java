package com.nbh.erp.user.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApproveUserRequest {

    @NotEmpty(message = "At least one role must be assigned to approved user")
    private List<String> roles;
}
