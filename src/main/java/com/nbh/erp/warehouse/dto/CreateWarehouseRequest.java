package com.nbh.erp.warehouse.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateWarehouseRequest {

    @NotBlank(message = "Warehouse code is required")
    @Size(min = 2, max = 20)
    private String code;

    @NotBlank(message = "Warehouse name is required")
    @Size(min = 2, max = 100)
    private String name;

    private String address;

    @JsonAlias({"contactNumber", "phone"})
    private String phone;

    private String contactPerson;

    private Boolean isPrimary = false;

    public String getContactNumber() {
        return phone;
    }

    public void setContactNumber(String contactNumber) {
        if (this.phone == null || this.phone.isBlank()) {
            this.phone = contactNumber;
        }
    }
}

