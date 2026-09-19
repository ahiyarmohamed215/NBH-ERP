package com.nbh.erp.audit.service;

import com.nbh.erp.audit.dto.AuditLogDto;
import com.nbh.erp.audit.entity.AuditLog;
import com.nbh.erp.audit.repository.AuditLogRepository;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AuditLogDto> searchLogs(
            String action,
            String entityName,
            String username,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable
    ) {
        Page<AuditLogDto> page = auditLogRepository
                .searchLogs(action, entityName, username, startDate, endDate, pageable)
                .map(AuditLogDto::from);
        return PagedResponse.from(page);
    }

    @Transactional
    public void log(String action, String entityName, String entityId, String details, String ipAddress) {
        String username = SecurityUtils.getCurrentUsername().orElse("system");

        AuditLog log = AuditLog.builder()
                .action(action)
                .entityName(entityName)
                .entityId(entityId)
                .username(username)
                .ipAddress(ipAddress)
                .details(details)
                .build();

        auditLogRepository.save(log);
    }
}
