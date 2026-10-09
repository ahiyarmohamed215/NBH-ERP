package com.nbh.erp.security.jwt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.config.RequestIdFilter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException, ServletException {
        String requestId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Access denied for request to {}: {}", requestId, request.getRequestURI(), accessDeniedException.getMessage());

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        final Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("status", HttpServletResponse.SC_FORBIDDEN);
        body.put("errorCode", "FORBIDDEN");
        body.put("error", "Forbidden");
        body.put("message", "You don't have permission to perform this action.");
        body.put("requestId", requestId);
        body.put("path", request.getRequestURI());
        body.put("timestamp", Instant.now().toString());

        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
