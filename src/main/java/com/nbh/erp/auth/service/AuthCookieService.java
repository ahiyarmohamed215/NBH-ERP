package com.nbh.erp.auth.service;

import com.nbh.erp.config.CorsConfig;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthCookieService {

    public static final String REFRESH_COOKIE_NAME = "nbh_refresh_token";
    public static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

    private final CorsConfig corsConfig;

    @Value("${app.security.cookie.secure:false}")
    private boolean cookieSecureConfig;

    @Value("${app.security.cookie.same-site:Lax}")
    private String cookieSameSite;

    @PostConstruct
    public void validateCookieSecurityConfig() {
        boolean isProdOnly = isProductionOnlyConfig();
        if (isProdOnly && !cookieSecureConfig) {
            log.warn("NOTICE: Production HTTPS origins configured without COOKIE_SECURE=true. Auto-enforcing Secure=true for production protection.");
        }
        log.info("AuthCookieService initialized: cookieName='{}', path='{}', sameSite='{}', secureConfig={}, isProductionOnly={}",
                REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, cookieSameSite, cookieSecureConfig, isProdOnly);
    }

    public void setRefreshCookie(HttpServletResponse response, HttpServletRequest request, String refreshToken, long durationMs) {
        boolean isSecure = determineSecure(request);
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(isSecure)
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ofMillis(durationMs))
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearRefreshCookie(HttpServletResponse response, HttpServletRequest request) {
        boolean isSecure = determineSecure(request);
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(isSecure)
                .path(REFRESH_COOKIE_PATH)
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public boolean determineSecure(HttpServletRequest request) {
        if (cookieSecureConfig) {
            return true;
        }
        if (request != null && (request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")))) {
            return true;
        }
        return isProductionOnlyConfig();
    }

    private boolean isProductionOnlyConfig() {
        if (corsConfig == null || corsConfig.getAllowedOriginSet() == null) {
            return false;
        }
        var origins = corsConfig.getAllowedOriginSet();
        boolean hasLocalhost = origins.stream().anyMatch(o -> o != null && (o.contains("localhost") || o.contains("127.0.0.1")));
        boolean hasHttps = origins.stream().anyMatch(o -> o != null && o.startsWith("https://"));
        return hasHttps && !hasLocalhost;
    }
}
