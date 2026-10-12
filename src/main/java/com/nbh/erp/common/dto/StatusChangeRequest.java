package com.nbh.erp.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.nbh.erp.common.exception.BusinessException;

public record StatusChangeRequest(@NotBlank(message="Status change reason is required") @Size(max=1000) String reason) {
    public static String requireReason(String value) {
        if (value == null || value.isBlank()) throw new BusinessException("Status change reason is required");
        if (value.trim().length() > 1000) throw new BusinessException("Status change reason must be 1000 characters or fewer");
        return value.trim();
    }
}
