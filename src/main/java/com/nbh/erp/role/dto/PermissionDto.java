package com.nbh.erp.role.dto;

import com.nbh.erp.role.entity.Permission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionDto {
    private Long id;
    private String name;
    private String module;
    private String description;

    public static PermissionDto from(Permission p) {
        return PermissionDto.builder()
                .id(p.getId())
                .name(p.getName())
                .module(p.getModule())
                .description(p.getDescription())
                .build();
    }
}
