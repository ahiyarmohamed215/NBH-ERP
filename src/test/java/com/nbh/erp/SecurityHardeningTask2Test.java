package com.nbh.erp;

import com.nbh.erp.auth.entity.RefreshSession;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import com.nbh.erp.auth.service.RefreshSessionCleanupService;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class SecurityHardeningTask2Test {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private RefreshSessionRepository refreshSessionRepository;

    @Autowired
    private RefreshSessionCleanupService cleanupService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Nested
    @DisplayName("Part 1: Secure CORS Configuration Tests")
    class CorsSecurityTests {

        @Test
        @DisplayName("Approved development origin (localhost:5173) is accepted with credentials")
        void approvedDevOriginAccepted() throws Exception {
            mvc.perform(options("/api/v1/health/live")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        }

        @Test
        @DisplayName("Approved production origin (https://nbh-erp.vercel.app) is accepted")
        void approvedProdOriginAccepted() throws Exception {
            mvc.perform(options("/api/v1/health/live")
                            .header(HttpHeaders.ORIGIN, "https://nbh-erp.vercel.app")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://nbh-erp.vercel.app"))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        }

        @Test
        @DisplayName("Unapproved arbitrary Vercel subdomain is strictly rejected")
        void unapprovedVercelSubdomainRejected() throws Exception {
            mvc.perform(options("/api/v1/health/live")
                            .header(HttpHeaders.ORIGIN, "https://malicious-tenant.vercel.app")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        }

        @Test
        @DisplayName("Unapproved external third-party domain is strictly rejected")
        void unapprovedExternalDomainRejected() throws Exception {
            mvc.perform(options("/api/v1/health/live")
                            .header(HttpHeaders.ORIGIN, "https://attacker.evil.com")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        }

        @Test
        @DisplayName("SSE /events preflight works correctly for approved origin")
        void ssePreflightAllowedForApprovedOrigin() throws Exception {
            mvc.perform(options("/api/v1/events")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization,Accept"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        }
    }

    @Nested
    @DisplayName("Part 2: JWT Secret Validation Tests")
    class JwtSecretValidationTests {

        @Test
        @DisplayName("Refuses startup when secret is null or blank")
        void refusesMissingSecret() {
            Exception ex1 = assertThrows(IllegalStateException.class,
                    () -> new JwtTokenProvider(null, 900000, 604800000));
            assertTrue(ex1.getMessage().contains("JWT signing secret is missing"));

            Exception ex2 = assertThrows(IllegalStateException.class,
                    () -> new JwtTokenProvider("   ", 900000, 604800000));
            assertTrue(ex2.getMessage().contains("JWT signing secret is missing"));
        }

        @Test
        @DisplayName("Refuses startup when secret is not valid Base64")
        void refusesNonBase64Secret() {
            Exception ex = assertThrows(IllegalStateException.class,
                    () -> new JwtTokenProvider("this-is-not-valid-base64!@#$%", 900000, 604800000));
            assertTrue(ex.getMessage().contains("JWT_SECRET must be a valid Base64-encoded string"));
        }

        @Test
        @DisplayName("Refuses startup when decoded secret is under 32 bytes (256 bits)")
        void refusesWeakSecret() {
            // "c2hvcnQ=" decodes to "short" (5 bytes)
            Exception ex = assertThrows(IllegalStateException.class,
                    () -> new JwtTokenProvider("c2hvcnQ=", 900000, 604800000));
            assertTrue(ex.getMessage().contains("JWT_SECRET is too weak"));
            assertTrue(ex.getMessage().contains("at least 32 bytes"));
        }

        @Test
        @DisplayName("Accepts valid 32+ byte Base64 secret and signs/validates tokens")
        void acceptsValidSecret() {
            // 32-byte key: "test-only-secret-key-32-bytes-long-123456" Base64 encoded
            String validSecret = "dGVzdC1vbmx5LXNlY3JldC1rZXktMzItYnl0ZXMtbG9uZy0xMjM0NTY=";
            JwtTokenProvider provider = new JwtTokenProvider(validSecret, 900000, 604800000);

            assertEquals(604800000L, provider.getRefreshMs());

            User user = User.builder().id(1L).username("testuser").tokenVersion(0L).build();
            UserPrincipal principal = UserPrincipal.create(user);
            Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList());

            String accessToken = provider.generateAccessToken(auth);
            assertNotNull(accessToken);
            assertTrue(provider.validateToken(accessToken, "ACCESS"));
            assertEquals("testuser", provider.getUsernameFromToken(accessToken));
            assertTrue(provider.matchesVersion(accessToken, 0L));

            String refreshToken = provider.generateRefreshToken("testuser", 0L, "sess-1", "tok-1");
            assertNotNull(refreshToken);
            assertTrue(provider.validateToken(refreshToken, "REFRESH"));
            assertEquals("testuser", provider.getUsernameFromToken(refreshToken));
        }
    }

    @Nested
    @DisplayName("Part 3: Refresh Session Cleanup Tests")
    class RefreshSessionCleanupTests {

        @Test
        @Transactional
        @DisplayName("Purges expired sessions past retention grace period while preserving active and recently expired sessions")
        void purgesOnlyExpiredEligibleSessions() {
            Instant now = Instant.now();

            // 1. Active session (expires in 7 days)
            RefreshSession active = new RefreshSession();
            active.setId("sess-active-" + UUID.randomUUID());
            active.setTokenId(UUID.randomUUID().toString());
            active.setUsername("user_active");
            active.setTokenVersion(1L);
            active.setExpiresAt(now.plus(7, ChronoUnit.DAYS));
            refreshSessionRepository.save(active);

            // 2. Recently expired session (expired 2 hours ago, within the 1-day retention grace period)
            RefreshSession recentlyExpired = new RefreshSession();
            recentlyExpired.setId("sess-recent-" + UUID.randomUUID());
            recentlyExpired.setTokenId(UUID.randomUUID().toString());
            recentlyExpired.setUsername("user_recent");
            recentlyExpired.setTokenVersion(1L);
            recentlyExpired.setExpiresAt(now.minus(2, ChronoUnit.HOURS));
            refreshSessionRepository.save(recentlyExpired);

            // 3. Old expired session (expired 3 days ago, outside retention grace period)
            RefreshSession oldExpired = new RefreshSession();
            oldExpired.setId("sess-old-" + UUID.randomUUID());
            oldExpired.setTokenId(UUID.randomUUID().toString());
            oldExpired.setUsername("user_old");
            oldExpired.setTokenVersion(1L);
            oldExpired.setExpiresAt(now.minus(3, ChronoUnit.DAYS));
            refreshSessionRepository.save(oldExpired);

            // Execute cleanup
            int purged = cleanupService.purgeExpiredSessions();
            assertTrue(purged >= 1, "Should purge at least the old expired session");

            // Verify active session remains untouched
            assertTrue(refreshSessionRepository.findById(active.getId()).isPresent(),
                    "Active session must NOT be deleted");

            // Verify recently expired session within grace period remains untouched
            assertTrue(refreshSessionRepository.findById(recentlyExpired.getId()).isPresent(),
                    "Session within retention grace period must NOT be deleted");

            // Verify old expired session was deleted
            assertFalse(refreshSessionRepository.findById(oldExpired.getId()).isPresent(),
                    "Session past retention grace period must be deleted");
        }
    }
}
