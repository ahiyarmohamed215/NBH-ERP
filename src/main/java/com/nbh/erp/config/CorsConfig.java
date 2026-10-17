package com.nbh.erp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://nbh-erp.vercel.app}")
    private String allowedOrigins;

    public Set<String> getAllowedOriginSet() {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.contains("*"))
                .toList();

        Set<String> approvedOrigins = new LinkedHashSet<>(origins);
        if (approvedOrigins.isEmpty()) {
            approvedOrigins.add("http://localhost:5173");
            approvedOrigins.add("http://localhost:3000");
            approvedOrigins.add("http://127.0.0.1:5173");
            approvedOrigins.add("https://nbh-erp.vercel.app");
        }
        return approvedOrigins;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        Set<String> approvedOrigins = getAllowedOriginSet();
        configuration.setAllowedOrigins(new ArrayList<>(approvedOrigins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Content-Disposition", "Idempotency-Key", "X-Request-Id"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
