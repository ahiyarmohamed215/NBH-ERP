package com.nbh.erp.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCategoryRequest {

    @Size(max = 20)
    private String code;

    @Size(max = 100)
    private String name;

    @jakarta.validation.constraints.Size(max=5000)
    private String description;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;
}
