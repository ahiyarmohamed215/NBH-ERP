package com.nbh.erp.audit.dto;

import com.nbh.erp.audit.entity.AuditLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDto {
    private Long id;
    private String action;
    private String entityName;
    private String entityId;
    private String username;
    private String ipAddress;
    private String details;
    private LocalDateTime createdAt;

    public static AuditLogDto from(AuditLog al) {
        return AuditLogDto.builder()
                .id(al.getId())
                .action(al.getAction())
                .entityName(al.getEntityName())
                .entityId(al.getEntityId())
                .username(al.getUsername())
                .ipAddress(al.getIpAddress())
                .details(al.getDetails())
                .createdAt(al.getCreatedAt())
                .build();
    }
}
