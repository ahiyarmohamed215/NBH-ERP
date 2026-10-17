package com.nbh.erp.security.csrf;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.auth.service.AuthCookieService;
import com.nbh.erp.config.CorsConfig;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class OriginValidationFilter extends OncePerRequestFilter {

    private final CorsConfig corsConfig;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public static final String X_REQUESTED_WITH_HEADER = "X-Requested-With";
    public static final String XML_HTTP_REQUEST = "XMLHttpRequest";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String method = request.getMethod();
        // Safe methods (GET, HEAD, OPTIONS) do not alter server state
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getServletPath();
        boolean isCookieAuthEndpoint = path != null && (path.endsWith("/refresh") || path.endsWith("/logout"));
        boolean hasRefreshCookie = hasRefreshCookie(request);

        // 1. Enforce anti-CSRF custom header on cookie-authenticated endpoints (/refresh, /logout) or requests bearing refresh cookies.
        // Standard browser form submissions (<form method="POST">), <img>, <iframe>, and cross-site script tags
        // cannot set custom request headers without triggering a preflight OPTIONS request.
        if (isCookieAuthEndpoint || hasRefreshCookie) {
            String xRequestedWith = request.getHeader(X_REQUESTED_WITH_HEADER);
            if (xRequestedWith == null || !XML_HTTP_REQUEST.equalsIgnoreCase(xRequestedWith.trim())) {
                log.warn("CSRF Header Rejected: missing or invalid '{}' on path '{}'", X_REQUESTED_WITH_HEADER, path);
                rejectRequest(response, "Cross-site request blocked: missing or invalid " + X_REQUESTED_WITH_HEADER + " header");
                return;
            }
        }

        // 2. Validate Origin and Referer headers against approved origin allowlist
        String origin = request.getHeader(HttpHeaders.ORIGIN);

        if (origin != null && !origin.isBlank()) {
            if (!isAllowedOrigin(origin.trim(), request)) {
                log.warn("CSRF Origin Validation Rejected: unapproved origin '{}' for path '{}'", origin, path);
                rejectRequest(response, "Cross-site request blocked by CSRF origin policy");
                return;
            }
        } else {
            // Origin is missing; check Referer
            String referer = request.getHeader(HttpHeaders.REFERER);
            if (referer != null && !referer.isBlank()) {
                String refererOrigin = extractOrigin(referer.trim());
                if (refererOrigin == null || !isAllowedOrigin(refererOrigin, request)) {
                    log.warn("CSRF Referer Validation Rejected: unapproved referer '{}' for path '{}'", referer, path);
                    rejectRequest(response, "Cross-site request blocked by CSRF referer policy");
                    return;
                }
            } else {
                // Both Origin and Referer are absent on a mutating request.
                // For cookie-authenticated endpoints or requests carrying auth cookies, reject unconditionally.
                if (isCookieAuthEndpoint || hasRefreshCookie) {
                    log.warn("CSRF Validation Rejected: mutating cookie-authenticated request to '{}' missing both Origin and Referer", path);
                    rejectRequest(response, "Cross-site request blocked: Origin or Referer header required for state-changing requests");
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean hasRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        for (Cookie c : cookies) {
            if (AuthCookieService.REFRESH_COOKIE_NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return true;
            }
        }
        return false;
    }

    private boolean isAllowedOrigin(String origin, HttpServletRequest request) {
        Set<String> allowedOrigins = corsConfig.getAllowedOriginSet();
        if (allowedOrigins.contains(origin)) {
            return true;
        }

        // Check if origin matches verified server name/port (without trusting spoofable X-Forwarded headers)
        String serverScheme = request.getScheme();
        String serverHost = request.getServerName();
        int serverPort = request.getServerPort();

        String sameOrigin;
        if (("http".equalsIgnoreCase(serverScheme) && serverPort == 80) ||
            ("https".equalsIgnoreCase(serverScheme) && serverPort == 443) ||
            serverPort <= 0) {
            sameOrigin = serverScheme + "://" + serverHost;
        } else {
            sameOrigin = serverScheme + "://" + serverHost + ":" + serverPort;
        }

        if (origin.equalsIgnoreCase(sameOrigin)) {
            return true;
        }

        // Check Host header against allowed origins or local loopback
        String hostHeader = request.getHeader(HttpHeaders.HOST);
        if (hostHeader != null && !hostHeader.isBlank()) {
            if (origin.equalsIgnoreCase(serverScheme + "://" + hostHeader) ||
                origin.equalsIgnoreCase("https://" + hostHeader) ||
                origin.equalsIgnoreCase("http://" + hostHeader)) {
                if (allowedOrigins.contains("http://" + hostHeader) ||
                    allowedOrigins.contains("https://" + hostHeader) ||
                    hostHeader.startsWith("localhost") ||
                    hostHeader.startsWith("127.0.0.1")) {
                    return true;
                }
            }
        }

        return false;
    }

    private String extractOrigin(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            if (scheme != null && host != null) {
                if (port == -1 || (scheme.equalsIgnoreCase("http") && port == 80) || (scheme.equalsIgnoreCase("https") && port == 443)) {
                    return scheme + "://" + host;
                }
                return scheme + "://" + host + ":" + port;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void rejectRequest(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of(
                "status", HttpServletResponse.SC_FORBIDDEN,
                "message", message,
                "error", "Forbidden"
        ));
    }
}
