package com.nbh.erp.auth.service;

import com.nbh.erp.auth.repository.RefreshSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshSessionCleanupService {

    private final RefreshSessionRepository refreshSessionRepository;

    @Value("${app.security.refresh-session.retention-days:1}")
    private int retentionDays;

    /**
     * Periodically purges expired refresh sessions that have exceeded the retention grace period.
     * Scheduled by default to run daily at 03:00 AM server time.
     *
     * @return count of deleted session records
     */
    @Scheduled(cron = "${app.security.refresh-session.cleanup-cron:0 0 3 * * ?}")
    @Transactional
    public int purgeExpiredSessions() {
        try {
            int safeRetention = Math.max(0, retentionDays);
            Instant cutoff = Instant.now().minus(safeRetention, ChronoUnit.DAYS);
            int deleted = refreshSessionRepository.deleteByExpiresAtBefore(cutoff);
            if (deleted > 0) {
                log.info("Purged {} expired refresh session(s) older than cutoff {}", deleted, cutoff);
            } else {
                log.debug("No expired refresh sessions eligible for purging (cutoff: {})", cutoff);
            }
            return deleted;
        } catch (Exception e) {
            log.error("Failed to purge expired refresh sessions: {}", e.getMessage(), e);
            return 0;
        }
    }
}
