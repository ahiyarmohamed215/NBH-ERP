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
import org.junit.jupiter.api.Nested;
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
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class SecurityHardeningTask3ATest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthCookieService cookieService;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String TEST_USERNAME = "task3a_verify_user";
    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        userRepository.findByUsername(TEST_USERNAME).ifPresent(userRepository::delete);
        userRepository.save(User.builder()
                .username(TEST_USERNAME)
                .email("task3a@example.com")
                .fullName("Task 3A Verification User")
                .password(passwordEncoder.encode(TEST_PASSWORD))
                .isActive(true)
                .approvalStatus("APPROVED")
                .tokenVersion(0L)
                .roles(new HashSet<>())
                .build());
    }

    private Cookie loginAndGetRefreshCookie() throws Exception {
        LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
        MvcResult res = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie = res.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
        assertNotNull(cookie, "Login must set nbh_refresh_token cookie");
        return cookie;
    }

    @Nested
    @DisplayName("1. CSRF Protection and Header Verification")
    class CsrfHeaderVerificationTests {

        @Test
        @DisplayName("Missing Origin AND Referer on /refresh is strictly blocked with HTTP 403 Forbidden")
        void missingOriginAndRefererBlockedOnRefresh() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header("X-Requested-With", "XMLHttpRequest")
                            // No Origin, no Referer
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Missing Origin AND Referer on /logout is strictly blocked with HTTP 403 Forbidden")
        void missingOriginAndRefererBlockedOnLogout() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/logout")
                            .cookie(refreshCookie)
                            .header("X-Requested-With", "XMLHttpRequest")
                            // No Origin, no Referer
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Missing X-Requested-With header on /refresh is strictly blocked with HTTP 403 Forbidden")
        void missingXRequestedWithBlockedOnRefresh() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            // Missing X-Requested-With
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Missing X-Requested-With header on /logout is strictly blocked with HTTP 403 Forbidden")
        void missingXRequestedWithBlockedOnLogout() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/logout")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            // Missing X-Requested-With
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Untrusted Origin is strictly blocked with HTTP 403 Forbidden")
        void untrustedOriginBlocked() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "https://malicious-attacker.org")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Untrusted subdomain is strictly blocked with HTTP 403 Forbidden")
        void untrustedSubdomainBlocked() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "https://subdomain.malicious-site.com")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Spoofed X-Forwarded-Host cannot bypass Origin validation")
        void spoofedXForwardedHostBlocked() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            // Attacker supplies evil Origin and spoofed X-Forwarded-Host matching the evil Origin
            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "https://evil.spoofed.org")
                            .header("X-Forwarded-Host", "evil.spoofed.org")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Legitimate same-origin request with approved Origin and X-Requested-With succeeds")
        void legitimateRequestSucceeds() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Safe GET /api/v1/auth/csrf bypasses origin check")
        void safeGetMethodBypassesOriginValidation() throws Exception {
            mvc.perform(get("/api/v1/auth/csrf"))
                    .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("2. Cookie Configuration and Security Verification")
    class CookieConfigurationTests {

        @Test
        @DisplayName("Verify Host-only cookie behavior (no Domain attribute)")
        void verifyHostOnlyCookie() throws Exception {
            Cookie cookie = loginAndGetRefreshCookie();
            assertNull(cookie.getDomain(), "Host-only cookie must NOT specify Domain attribute");
            assertEquals(AuthCookieService.REFRESH_COOKIE_PATH, cookie.getPath(), "Path must be /api/v1/auth");
            assertTrue(cookie.isHttpOnly(), "Cookie must be HttpOnly");
        }

        @Test
        @DisplayName("Logout clears refresh cookie with Max-Age=0")
        void logoutClearsCookieWithMaxAgeZero() throws Exception {
            Cookie refreshCookie = loginAndGetRefreshCookie();

            MvcResult res = mvc.perform(post("/api/v1/auth/logout")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie clearedCookie = res.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(clearedCookie);
            assertEquals(0, clearedCookie.getMaxAge(), "Cleared cookie must have Max-Age=0");
            assertEquals("", clearedCookie.getValue(), "Cleared cookie value must be empty");
        }

        @Test
        @DisplayName("Production HTTPS requests automatically enforce Secure flag")
        void productionHttpsEnforcesSecureFlag() {
            org.springframework.mock.web.MockHttpServletRequest httpsRequest =
                    new org.springframework.mock.web.MockHttpServletRequest();
            httpsRequest.setSecure(true);

            assertTrue(cookieService.determineSecure(httpsRequest), "Secure flag must be true for HTTPS requests");

            org.springframework.mock.web.MockHttpServletRequest protoRequest =
                    new org.springframework.mock.web.MockHttpServletRequest();
            protoRequest.addHeader("X-Forwarded-Proto", "https");

            assertTrue(cookieService.determineSecure(protoRequest), "Secure flag must be true when X-Forwarded-Proto is https");
        }
    }

    @Nested
    @DisplayName("3. Concurrent Two-Tab Refresh and Replay Detection")
    class ConcurrentRefreshTests {

        @Test
        @DisplayName("Sequential two-tab refresh succeeds via rotated token chain")
        void sequentialTwoTabRefreshSucceeds() throws Exception {
            // Tab 1 logs in and gets initial cookie
            Cookie cookieTab1 = loginAndGetRefreshCookie();

            // Tab 1 refreshes
            MvcResult resTab1 = mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(cookieTab1)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie rotatedCookieForTab2 = resTab1.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(rotatedCookieForTab2);

            // Tab 2 uses the freshly rotated cookie from the shared browser cookie store
            MvcResult resTab2 = mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(rotatedCookieForTab2)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode dataTab2 = objectMapper.readTree(resTab2.getResponse().getContentAsString()).get("data");
            assertNotNull(dataTab2.get("accessToken"));
        }

        @Test
        @DisplayName("Replay detection: Re-using the initial cookie after it was rotated is rejected with 401")
        void tokenReplayRejection() throws Exception {
            Cookie initialCookie = loginAndGetRefreshCookie();

            // First use (Tab 1) succeeds
            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(initialCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk());

            // Replay use (attempting to use initialCookie again) MUST fail with 401
            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(initialCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }
    }
}
