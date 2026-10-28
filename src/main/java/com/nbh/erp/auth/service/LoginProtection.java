package com.nbh.erp.auth.service;

import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** Single-instance staging protection. State is bounded and expires; never persists account locks. */
@Component
public class LoginProtection {
    private static final long WINDOW = Duration.ofMinutes(15).toMillis();
    private static final int CAPACITY = 20_000;
    private final Clock clock;
    private final Map<String, Account> accounts = new HashMap<>();
    private final Map<String, Ip> ips = new HashMap<>();

    public LoginProtection() { this(Clock.systemUTC()); }
    public LoginProtection(Clock clock) { this.clock = clock; }

    // 120 requests/minute with a burst of 120 permits many colleagues sharing an office IP.
    public synchronized boolean allowIp(String ip) {
        long now = clock.millis();
        Ip state = ips.get(ip);
        if (state == null) {
            if (ips.size() >= CAPACITY) ips.values().removeIf(value -> now - value.updated >= WINDOW);
            if (ips.size() >= CAPACITY) return false; // Fail closed instead of evicting active limits.
            state = new Ip(now);
            ips.put(ip, state);
        }
        state.tokens = Math.min(120, state.tokens + Math.max(0, now - state.updated) / 500.0);
        state.updated = now;
        if (state.tokens < 1) return false;
        state.tokens--;
        return true;
    }

    // Reserve before hashing: simultaneous requests cannot all pass the failure threshold.
    public synchronized boolean beginAccount(String key) {
        long now = clock.millis();
        Account state = accounts.get(key);
        if (state == null || now - state.updated >= WINDOW) {
            if (state == null) {
                if (accounts.size() >= CAPACITY) accounts.values().removeIf(value -> now - value.updated >= WINDOW);
                if (accounts.size() >= CAPACITY) return false;
            }
            state = new Account();
            accounts.put(key, state);
        }
        if (now < state.until) return false; // Rejected attempts never extend the cooldown.
        if (state.until != 0) { state.attempts = 0; state.until = 0; }
        state.updated = now;
        if (++state.attempts >= 5) {
            state.until = now + Math.min(300_000L, 30_000L << Math.min(state.round++, 4));
        }
        return true;
    }

    public synchronized void success(String key) { accounts.remove(key); }

    private static class Account { int attempts, round; long until, updated; }
    private static class Ip { double tokens = 120; long updated; Ip(long now) { updated = now; } }
}
