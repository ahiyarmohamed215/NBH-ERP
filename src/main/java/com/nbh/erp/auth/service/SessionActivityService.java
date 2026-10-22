package com.nbh.erp.auth.service;

import com.nbh.erp.auth.entity.RefreshSession;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Duration;

/** Only explicit browser interaction advances the idle deadline; API traffic and JWT rotation do not. */
@Service
@RequiredArgsConstructor
public class SessionActivityService {
    private static final Duration IDLE_TIMEOUT = Duration.ofMinutes(30);
    private final RefreshSessionRepository sessions;
    private final Clock clock;

    public void requireActive(RefreshSession session) {
        if (session.getLastActivityAt() == null || !clock.instant().isBefore(session.getLastActivityAt().plus(IDLE_TIMEOUT)))
            throw new BadCredentialsException("Session expired after 30 minutes of inactivity");
    }

    @Transactional(readOnly = true)
    public void requireActive(String id, String username) {
        var session = sessions.findById(id).orElseThrow(() -> new BadCredentialsException("Session expired"));
        if (!session.getUsername().equals(username)) throw new BadCredentialsException("Session expired");
        requireActive(session);
    }

    @Transactional
    public void record(String id, String username) {
        if (id == null) throw new BadCredentialsException("Please sign in again");
        var session = sessions.lockById(id).orElseThrow(() -> new BadCredentialsException("Session expired"));
        if (!session.getUsername().equals(username)) throw new BadCredentialsException("Session expired");
        requireActive(session);
        session.setLastActivityAt(clock.instant());
        sessions.save(session);
    }
}
