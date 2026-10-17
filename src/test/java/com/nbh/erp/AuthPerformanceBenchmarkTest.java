package com.nbh.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.service.AuthCookieService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class AuthPerformanceBenchmarkTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String TEST_USERNAME = "perf_benchmark_user";
    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        userRepository.findByUsername(TEST_USERNAME).ifPresent(userRepository::delete);
        userRepository.save(User.builder()
                .username(TEST_USERNAME)
                .email("perf@example.com")
                .fullName("Performance Benchmark User")
                .password(passwordEncoder.encode(TEST_PASSWORD))
                .isActive(true)
                .approvalStatus("APPROVED")
                .tokenVersion(0L)
                .roles(new HashSet<>())
                .build());
    }

    @Test
    @DisplayName("Benchmark Login and Silent Refresh Response Times")
    void benchmarkLoginAndRefresh() throws Exception {
        LoginRequest loginRequest = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
        String loginBody = objectMapper.writeValueAsString(loginRequest);

        // Warm up
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody));
        }

        // Measure Login
        List<Long> loginTimes = new ArrayList<>();
        Cookie latestRefreshCookie = null;

        for (int i = 0; i < 10; i++) {
            long start = System.nanoTime();
            MvcResult res = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginBody))
                    .andExpect(status().isOk())
                    .andReturn();
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            loginTimes.add(elapsed);

            Cookie[] cookies = res.getResponse().getCookies();
            for (Cookie c : cookies) {
                if (AuthCookieService.REFRESH_COOKIE_NAME.equals(c.getName())) {
                    latestRefreshCookie = c;
                }
            }
        }

        assertNotNull(latestRefreshCookie, "Refresh cookie must be present for silent refresh benchmark");

        // Measure Silent Refresh Rotation
        List<Long> refreshTimes = new ArrayList<>();
        Cookie activeCookie = latestRefreshCookie;

        for (int i = 0; i < 10; i++) {
            long start = System.nanoTime();
            MvcResult refreshRes = mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(activeCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            refreshTimes.add(elapsed);

            // Extract rotated cookie for next iteration
            for (Cookie c : refreshRes.getResponse().getCookies()) {
                if (AuthCookieService.REFRESH_COOKIE_NAME.equals(c.getName())) {
                    activeCookie = c;
                }
            }
        }

        double avgLogin = loginTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long minLogin = loginTimes.stream().mapToLong(Long::longValue).min().orElse(0);
        long maxLogin = loginTimes.stream().mapToLong(Long::longValue).max().orElse(0);

        double avgRefresh = refreshTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long minRefresh = refreshTimes.stream().mapToLong(Long::longValue).min().orElse(0);
        long maxRefresh = refreshTimes.stream().mapToLong(Long::longValue).max().orElse(0);

        System.out.println("=================================================");
        System.out.println("AUTH PERFORMANCE BENCHMARK RESULTS (10 runs)");
        System.out.println(String.format("Login API Response Time:        avg=%.2f ms | min=%d ms | max=%d ms (BCrypt cost=10)", avgLogin, minLogin, maxLogin));
        System.out.println(String.format("Silent Refresh Response Time:   avg=%.2f ms | min=%d ms | max=%d ms (DB Lock + JWT Gen)", avgRefresh, minRefresh, maxRefresh));
        System.out.println("=================================================");
    }
}
