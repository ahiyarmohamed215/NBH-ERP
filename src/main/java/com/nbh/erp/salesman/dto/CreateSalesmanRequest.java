package com.nbh.erp.salesman.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSalesmanRequest {

    private String salesmanCode; // Optional: auto-generated if blank

    @NotBlank(message = "Salesman name is required")
    @Size(min = 2, max = 100)
    private String name;

    private String phone;

    private String email;

    private BigDecimal commissionRate = BigDecimal.ZERO;
}
