package com.nbh.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.entity.RefreshSession;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import com.nbh.erp.auth.service.AuthCookieService;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.cors.allowed-origins=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://erp.example.test")
class SecurityHardeningTask3Test {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshSessionRepository refreshSessionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User testUser;
    private static final String TEST_USERNAME = "task3_user";
    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        // Ensure clean test user
        userRepository.findByUsername(TEST_USERNAME).ifPresent(userRepository::delete);
        testUser = userRepository.save(User.builder()
                .username(TEST_USERNAME)
                .email("task3_user@example.com")
                .fullName("Task 3 Test User")
                .password(passwordEncoder.encode(TEST_PASSWORD))
                .isActive(true)
                .approvalStatus("APPROVED")
                .tokenVersion(0L)
                .roles(new HashSet<>())
                .build());
    }

    @Nested
    @DisplayName("1. Cookie Transport & Access Token Storage")
    class CookieAndTokenTests {

        @Test
        @DisplayName("Login sets HttpOnly, SameSite, Path=/api/v1/auth cookie and omits refreshToken from JSON response")
        void loginSetsHttpOnlyCookieAndOmitsTokenFromResponse() throws Exception {
            LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);

            MvcResult result = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                    .andReturn();

            String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(setCookie);
            assertTrue(setCookie.contains(AuthCookieService.REFRESH_COOKIE_NAME + "="), "Set-Cookie must contain nbh_refresh_token");
            assertTrue(setCookie.contains("HttpOnly"), "Cookie must be HttpOnly");
            assertTrue(setCookie.contains("Path=/api/v1/auth"), "Cookie path must be /api/v1/auth");
            assertTrue(setCookie.contains("SameSite=Lax") || setCookie.contains("SameSite=Strict"), "Cookie must have SameSite policy");

            // Verify JSON body does not contain refresh token
            String content = result.getResponse().getContentAsString();
            JsonNode root = objectMapper.readTree(content);
            JsonNode dataNode = root.get("data");
            assertNotNull(dataNode.get("accessToken"));
            assertFalse(dataNode.get("accessToken").asText().isBlank());
            assertTrue(dataNode.get("refreshToken") == null || dataNode.get("refreshToken").isNull(),
                    "refreshToken field in JSON body must be null or omitted");
        }

        @Test
        @DisplayName("Access token expires in 15 minutes (900,000 ms) and Refresh token in 30 minutes (1,800,000 ms)")
        void tokenLifetimesMatchRequirements() {
            var principal = UserPrincipal.create(testUser);
            var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
            String accessToken = tokenProvider.generateAccessToken(auth);

            var accessClaims = tokenProvider.claims(accessToken);
            Date accessIssued = accessClaims.getIssuedAt();
            Date accessExpiry = accessClaims.getExpiration();
            long accessDurationMs = accessExpiry.getTime() - accessIssued.getTime();
            // Allow 5s delta for test execution clock
            assertTrue(Math.abs(accessDurationMs - 900000L) < 5000L, "Access token lifetime must be 15 minutes");

            String refreshToken = tokenProvider.generateRefreshToken(TEST_USERNAME, 0L, "test-sid", "test-tid");
            var refreshClaims = tokenProvider.claims(refreshToken);
            Date refreshIssued = refreshClaims.getIssuedAt();
            Date refreshExpiry = refreshClaims.getExpiration();
            long refreshDurationMs = refreshExpiry.getTime() - refreshIssued.getTime();
            assertTrue(Math.abs(refreshDurationMs - 1800000L) < 5000L, "Refresh token lifetime must be 30 minutes");
        }
    }

    @Nested
    @DisplayName("2. Refresh Session Rotation, Replay Detection & Revocation")
    class RefreshRotationTests {

        @Test
        @DisplayName("Silent refresh via HttpOnly cookie rotates session and issues new access token")
        void refreshViaCookieSucceedsAndRotates() throws Exception {
            // 1. Login to get initial refresh cookie
            LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
            MvcResult loginResult = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie refreshCookie = loginResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(refreshCookie);
            String initialRefreshToken = refreshCookie.getValue();

            // 2. Perform refresh using the cookie
            MvcResult refreshResult = mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                    .andReturn();

            Cookie rotatedCookie = refreshResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(rotatedCookie);
            assertNotEquals(initialRefreshToken, rotatedCookie.getValue(), "Rotated refresh token must differ from initial");

            // Verify access token is received
            JsonNode root = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
            assertNotNull(root.get("data").get("accessToken"));
            assertTrue(root.get("data").get("refreshToken") == null || root.get("data").get("refreshToken").isNull());
        }

        @Test
        @DisplayName("Replay detection rejects reused refresh token")
        void replayDetectionRejectsReusedToken() throws Exception {
            // 1. Login
            LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
            MvcResult loginResult = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie refreshCookie = loginResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(refreshCookie);

            // 2. First refresh (valid)
            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk());

            // 3. Replay attack: try using the old cookie a second time
            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Expired refresh session is rejected")
        void expiredSessionIsRejected() throws Exception {
            String sid = UUID.randomUUID().toString();
            String tid = UUID.randomUUID().toString();

            RefreshSession expired = new RefreshSession();
            expired.setId(sid);
            expired.setTokenId(tid);
            expired.setUsername(TEST_USERNAME);
            expired.setTokenVersion(0L);
            expired.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
            refreshSessionRepository.save(expired);

            String expiredToken = tokenProvider.generateRefreshToken(TEST_USERNAME, 0L, sid, tid);
            Cookie cookie = new Cookie(AuthCookieService.REFRESH_COOKIE_NAME, expiredToken);
            cookie.setPath(AuthCookieService.REFRESH_COOKIE_PATH);

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(cookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Revoked tokenVersion rejects session")
        void revokedSessionByTokenVersionIsRejected() throws Exception {
            // Login to create session
            LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
            MvcResult loginResult = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie refreshCookie = loginResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);

            // Increment user tokenVersion (revoking all prior tokens)
            testUser.setTokenVersion(testUser.getTokenVersion() + 1);
            userRepository.save(testUser);

            mvc.perform(post("/api/v1/auth/refresh")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Logout clears refresh cookie and revokes session from database")
        void logoutClearsCookieAndRevokesSession() throws Exception {
            // 1. Login
            LoginRequest request = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
            MvcResult loginResult = mvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie refreshCookie = loginResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(refreshCookie);
            var claims = tokenProvider.claims(refreshCookie.getValue());
            String sid = claims.get("sid", String.class);
            assertTrue(refreshSessionRepository.findById(sid).isPresent(), "Session must exist in DB before logout");

            // 2. Logout
            MvcResult logoutResult = mvc.perform(post("/api/v1/auth/logout")
                            .cookie(refreshCookie)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();

            // Verify cookie cleared (Max-Age=0)
            Cookie clearedCookie = logoutResult.getResponse().getCookie(AuthCookieService.REFRESH_COOKIE_NAME);
            assertNotNull(clearedCookie);
            assertEquals(0, clearedCookie.getMaxAge(), "Cookie maxAge must be 0 on logout");

            // Verify database session revoked
            assertFalse(refreshSessionRepository.findById(sid).isPresent(), "Session must be removed from DB upon logout");
        }
    }

    @Nested
    @DisplayName("3. CSRF and Origin Protection")
    class CsrfOriginProtectionTests {

        @Test
        @DisplayName("Unapproved cross-site origin on /refresh is strictly blocked with HTTP 403")
        void unapprovedOriginBlocked() throws Exception {
            mvc.perform(post("/api/v1/auth/refresh")
                            .header(HttpHeaders.ORIGIN, "https://malicious-site.com")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Unapproved cross-site referer on /refresh is strictly blocked with HTTP 403")
        void unapprovedRefererBlocked() throws Exception {
            mvc.perform(post("/api/v1/auth/refresh")
                            .header(HttpHeaders.REFERER, "https://attacker.evil.org/phishing")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Approved origin (localhost:5173) is accepted by origin policy")
        void approvedOriginAccepted() throws Exception {
            // When refresh token is absent, approved origin proceeds past CSRF filter to bad credentials (401), NOT 403
            mvc.perform(post("/api/v1/auth/refresh")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Explicitly configured production origin is accepted")
        void approvedProductionOriginAccepted() throws Exception {
            mvc.perform(post("/api/v1/auth/refresh")
                            .header(HttpHeaders.ORIGIN, "https://erp.example.test")
                            .header("X-Requested-With", "XMLHttpRequest")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("GET /api/v1/auth/csrf endpoint is accessible")
        void csrfEndpointReturnsOk() throws Exception {
            mvc.perform(get("/api/v1/auth/csrf"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("UP"));
        }
    }
}
