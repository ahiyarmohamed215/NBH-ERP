package com.nbh.erp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DaySummaryDto {
    private LocalDate date;
    private long totalActions;
    private long totalCreates;
    private long totalUpdates;
    private long totalStatusChanges;
    private Map<String, Long> moduleBreakdown;
    private Map<String, Long> userBreakdown;
    private List<AuditLogDto> logs;
}
