package com.nbh.erp.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomerRequest {

    private String customerCode; // Optional: auto-generated if null

    @NotBlank(message = "Customer name is required")
    @Size(min = 2, max = 150)
    private String name;

    private String contactPerson;

    private String phone;

    private String email;

    private String address;

    private BigDecimal creditLimit = BigDecimal.ZERO;
}
