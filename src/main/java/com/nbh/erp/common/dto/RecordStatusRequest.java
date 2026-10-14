package com.nbh.erp.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RecordStatusRequest(
    @NotBlank @Pattern(regexp = "DRAFT|ACTIVE|INACTIVE", message = "Status must be DRAFT, ACTIVE, or INACTIVE") String status,
    @NotBlank @Size(max = 1000, message = "Status change reason must be 1000 characters or fewer") String reason
) {}
