package com.nbh.erp.user.dto;

/** Only assignment labels, without employee contact details or permission sets. */
public record StaffReferenceDto(Long id, String username, String fullName, String employeeCode, Boolean isActive, java.util.List<String> roles) {
    public static StaffReferenceDto from(UserDto user) {
        return new StaffReferenceDto(user.getId(), user.getUsername(), user.getFullName(), user.getEmployeeCode(), user.getIsActive(), user.getRoles() != null ? java.util.List.copyOf(user.getRoles()) : java.util.List.of());
    }
}
