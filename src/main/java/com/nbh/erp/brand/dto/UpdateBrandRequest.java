package com.nbh.erp.brand.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateBrandRequest {

    @Size(max = 150, message = "Brand name must not exceed 150 characters")
    private String name;

    @jakarta.validation.constraints.Size(max=5000)
    private String description;
}
