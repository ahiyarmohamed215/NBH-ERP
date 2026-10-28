package com.nbh.erp.security;

import com.nbh.erp.auth.service.LoginProtection;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

public class LoginThrottleFilter extends OncePerRequestFilter {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(LoginThrottleFilter.class);
    private final java.util.concurrent.atomic.AtomicLong nextAudit = new java.util.concurrent.atomic.AtomicLong();
    private final LoginProtection protection;
    public LoginThrottleFilter(LoginProtection protection) { this.protection = protection; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // Tomcat resolves the address only through the configured trusted loopback proxy.
        // Do not trust client-supplied forwarding headers here.
        if ("POST".equals(request.getMethod()) && "/api/v1/auth/login".equals(request.getServletPath())
                && !protection.allowIp(request.getRemoteAddr())) {
            long now = System.currentTimeMillis();
            long next = nextAudit.get();
            if (now >= next && nextAudit.compareAndSet(next, now + 60_000)) {
                LOG.warn("login outcome=ip_throttled"); // Fixed event; bounded volume, no attacker-controlled fields.
            }
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json");
            response.getWriter().write("{\"success\":false,\"message\":\"Too many sign-in attempts. Please wait and try again.\",\"errorCode\":\"LOGIN_THROTTLED\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
