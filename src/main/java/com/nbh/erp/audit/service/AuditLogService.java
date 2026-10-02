package com.nbh.erp.audit.service;

import com.nbh.erp.audit.dto.AuditLogDto;
import com.nbh.erp.audit.dto.DaySummaryDto;
import com.nbh.erp.audit.entity.AuditLog;
import com.nbh.erp.audit.repository.AuditLogRepository;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AuditLogDto> searchLogs(
            String action,
            String module,
            String entityName,
            String username,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable
    ) {
        Page<AuditLogDto> page = auditLogRepository
                .searchLogs(action, module, entityName, username, startDate, endDate, pageable)
                .map(AuditLogDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public DaySummaryDto getDaySummary(LocalDate date) {
        LocalDate targetDate = (date != null) ? date : LocalDate.now();
        LocalDateTime startOfDay = targetDate.atStartOfDay();
        LocalDateTime endOfDay = targetDate.atTime(23, 59, 59, 999999999);

        List<AuditLog> dayLogs = auditLogRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startOfDay, endOfDay);

        long totalActions = dayLogs.size();
        long totalCreates = 0;
        long totalUpdates = 0;
        long totalStatusChanges = 0;

        Map<String, Long> moduleBreakdown = new LinkedHashMap<>();
        Map<String, Long> userBreakdown = new LinkedHashMap<>();

        for (AuditLog logItem : dayLogs) {
            String act = (logItem.getAction() != null) ? logItem.getAction().toUpperCase() : "";
            if (act.contains("CREATE") || act.contains("ADD")) {
                totalCreates++;
            } else if (act.contains("UPDATE") || act.contains("EDIT")) {
                totalUpdates++;
            } else {
                totalStatusChanges++;
            }

            String mod = (logItem.getModule() != null && !logItem.getModule().isBlank())
                    ? logItem.getModule()
                    : inferModule(logItem.getEntityName());
            moduleBreakdown.put(mod, moduleBreakdown.getOrDefault(mod, 0L) + 1);

            String userKey = logItem.getUsername();
            if (logItem.getUserFullName() != null && !logItem.getUserFullName().isBlank()) {
                userKey = logItem.getUserFullName() + " (" + logItem.getUsername() + ")";
            }
            userBreakdown.put(userKey, userBreakdown.getOrDefault(userKey, 0L) + 1);
        }

        List<AuditLogDto> dtoList = dayLogs.stream()
                .map(AuditLogDto::from)
                .collect(Collectors.toList());

        return DaySummaryDto.builder()
                .date(targetDate)
                .totalActions(totalActions)
                .totalCreates(totalCreates)
                .totalUpdates(totalUpdates)
                .totalStatusChanges(totalStatusChanges)
                .moduleBreakdown(moduleBreakdown)
                .userBreakdown(userBreakdown)
                .logs(dtoList)
                .build();
    }

    @Transactional
    public void log(String action, String module, String entityName, String entityId, String details) {
        log(action, module, entityName, entityId, details, null);
    }

    @Transactional
    public void log(String action, String entityName, String entityId, String details) {
        log(action, inferModule(entityName), entityName, entityId, details, null);
    }

    @Transactional
    public void log(String action, String entityName, String entityId, String details, String ipAddress) {
        log(action, inferModule(entityName), entityName, entityId, details, ipAddress);
    }

    @Transactional
    public void log(String action, String module, String entityName, String entityId, String details, String ipAddress) {
        String username = SecurityUtils.getCurrentUsername().orElse("system");
        String fullName = SecurityUtils.getCurrentUserPrincipal().map(UserPrincipal::getFullName).orElse(null);
        String role = SecurityUtils.getCurrentUserPrincipal()
                .map(p -> p.getAuthorities().stream().map(Object::toString).filter(a -> a.startsWith("ROLE_")).findFirst().orElse("USER"))
                .orElse("SYSTEM");

        String effectiveModule = (module != null && !module.isBlank()) ? module.toUpperCase() : inferModule(entityName);

        AuditLog auditLog = AuditLog.builder()
                .action(action)
                .module(effectiveModule)
                .entityName(entityName)
                .entityId(entityId)
                .username(username)
                .userFullName(fullName)
                .userRole(role)
                .ipAddress(ipAddress)
                .details(details)
                .build();

        auditLogRepository.save(auditLog);
        log.debug("AuditLog recorded: action={}, module={}, entity={}/{}, user={}", action, effectiveModule, entityName, entityId, username);
    }

    public static String inferModule(String entityName) {
        if (entityName == null) return "GENERAL";
        String lower = entityName.toLowerCase();
        if (lower.contains("customer")) return "CUSTOMERS";
        if (lower.contains("delivery") || lower.contains("vehicle") || lower.contains("route") || lower.contains("trip")) return "DELIVERY";
        if (lower.contains("product") || lower.contains("inventory") || lower.contains("warehouse") || lower.contains("brand") || lower.contains("category") || lower.contains("quota") || lower.contains("adjustment")) return "INVENTORY";
        if (lower.contains("supplier") || lower.contains("grn") || lower.contains("gtn") || lower.contains("purchas")) return "PURCHASING";
        if (lower.contains("invoice") || lower.contains("sale") || lower.contains("payment") || lower.contains("quotation")) return "SALES";
        if (lower.contains("user") || lower.contains("role") || lower.contains("employee") || lower.contains("payroll") || lower.contains("attendance")) return "EMPLOYEES";
        return "GENERAL";
    }
}

