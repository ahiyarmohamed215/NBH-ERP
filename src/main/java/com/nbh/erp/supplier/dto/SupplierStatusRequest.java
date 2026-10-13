package com.nbh.erp.supplier.dto;
public record SupplierStatusRequest(
 @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp="DRAFT|ACTIVE|INACTIVE") String status,
 @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason
) {}
