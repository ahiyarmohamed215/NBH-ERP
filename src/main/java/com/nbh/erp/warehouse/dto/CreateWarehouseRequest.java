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

    @Size(max = 20)
    private String code;

    @Size(max = 100)
    private String name;

    @Size(max=5000)
    private String address;

    @Size(max = 5000)
    private String remarks;

    @jakarta.validation.constraints.Pattern(regexp = "DRAFT|ACTIVE|INACTIVE")
    private String status;

    @JsonAlias({"contactNumber", "phone"})
    @Size(max=30)
    @com.nbh.erp.common.validation.ValidPhone
    private String phone;

    @Size(max=100)
    private String contactPerson;

    public String getContactNumber() {
        return phone;
    }

    public void setContactNumber(String contactNumber) {
        if (this.phone == null || this.phone.isBlank()) {
            this.phone = contactNumber;
        }
    }
}

