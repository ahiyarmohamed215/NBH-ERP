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

    @Size(max=20,message="Supplier code must be 20 characters or fewer")
    @jakarta.validation.constraints.Pattern(regexp="^$|[A-Za-z0-9][A-Za-z0-9_-]*",message="Supplier code may contain letters, numbers, hyphens and underscores")
    private String supplierCode; // Optional: auto-generated if null/empty

    @Size(max = 150)
    private String name;

    @Size(max=100,message="Contact person must be 100 characters or fewer")
    private String contactPerson;

    @Size(max=30)
    @com.nbh.erp.common.validation.ValidPhone
    private String phone;

    @jakarta.validation.constraints.Email(message="Enter a valid email address")
    @Size(max=100,message="Email must be 100 characters or fewer")
    private String email;

    @Size(max=5000,message="Address must be 5000 characters or fewer")
    private String address;

    @jakarta.validation.constraints.Pattern(regexp="DRAFT|ACTIVE|INACTIVE")
    private String status;
}
