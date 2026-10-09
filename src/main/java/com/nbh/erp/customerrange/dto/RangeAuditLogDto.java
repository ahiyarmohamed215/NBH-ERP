package com.nbh.erp.customerrange.dto;

import com.nbh.erp.customerrange.entity.CustomerRangeAuditLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RangeAuditLogDto {
    private Long id;
    private String actionType;
    private Long targetId;
    private String details;
    private String performedBy;
    private LocalDateTime performedAt;

    public static RangeAuditLogDto from(CustomerRangeAuditLog log) {
        return RangeAuditLogDto.builder()
                .id(log.getId())
                .actionType(log.getActionType())
                .targetId(log.getTargetId())
                .details(log.getDetails())
                .performedBy(log.getPerformedBy())
                .performedAt(log.getPerformedAt())
                .build();
    }
}
