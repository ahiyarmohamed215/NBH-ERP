package com.nbh.erp.grn.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CancelGrnRequest {

    @NotBlank(message = "Cancellation reason is required")
    @jakarta.validation.constraints.Size(max=1000)
    private String reason;
}
