package com.nbh.erp.supplier.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSupplierRequest {

    private String supplierCode; // Optional: auto-generated if null/empty

    @NotBlank(message = "Supplier name is required")
    @Size(min = 2, max = 150)
    private String name;

    private String contactPerson;

    private String phone;

    private String email;

    private String address;
}
