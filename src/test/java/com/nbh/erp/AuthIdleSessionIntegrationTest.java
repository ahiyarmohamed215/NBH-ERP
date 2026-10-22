package com.nbh.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.auth.entity.RefreshSession;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import com.nbh.erp.auth.service.AuthService;
import com.nbh.erp.auth.service.SessionActivityService;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.time.*;
import java.util.HashSet;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class AuthIdleSessionIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired RefreshSessionRepository sessions;
    @Autowired JwtTokenProvider tokens;
    @Autowired AuthService auth;
    @Autowired SessionActivityService activity;
    MockMvc mvc;
    String access, refresh, sid;

    @BeforeEach void login() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        if (users.findByUsername("idle_regression").isEmpty()) users.save(User.builder()
            .username("idle_regression").email("idle_regression@example.com").fullName("Idle Test")
            .password(passwords.encode("Password123!")).isActive(true).approvalStatus("APPROVED")
            .tokenVersion(0L).roles(new HashSet<>()).build());
        var result = mvc.perform(post("/api/v1/auth/login").contentType("application/json")
            .content("{\"username\":\"idle_regression\",\"password\":\"Password123!\"}"))
            .andExpect(status().isOk()).andReturn();
        access = new ObjectMapper().readTree(result.getResponse().getContentAsString()).path("data").path("accessToken").asText();
        refresh = result.getResponse().getCookie(com.nbh.erp.auth.service.AuthCookieService.REFRESH_COOKIE_NAME).getValue();
        sid = tokens.claims(access).get("sid", String.class);
        assertNotNull(sid);
    }

    private void age(long minutes) {
        var session = sessions.findById(sid).orElseThrow();
        session.setLastActivityAt(Instant.now().minus(Duration.ofMinutes(minutes)));
        // Keep cryptographic/session expiry in the future to isolate the human-idle rule.
        session.setExpiresAt(Instant.now().plusSeconds(1800));
        sessions.saveAndFlush(session);
    }

    @Test void pollingAndRefreshNeverAdvanceHumanActivity() throws Exception {
        age(29);
        var before = sessions.findById(sid).orElseThrow().getLastActivityAt();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access)).andExpect(status().isOk());
        var renewed = auth.refreshToken(refresh);
        assertEquals(sid, tokens.claims(renewed.getAccessToken()).get("sid", String.class));
        assertEquals(before, sessions.findById(sid).orElseThrow().getLastActivityAt());
        age(31);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + renewed.getAccessToken())).andExpect(status().isUnauthorized());
        assertThrows(BadCredentialsException.class, () -> auth.refreshToken(renewed.getRefreshToken()));
    }

    @Test void explicitActivityRenewsButCannotReviveExpiredSession() throws Exception {
        age(29);
        mvc.perform(post("/api/v1/auth/activity").header("Authorization", "Bearer " + access)
            .header("X-Requested-With", "XMLHttpRequest")).andExpect(status().isOk());
        assertTrue(sessions.findById(sid).orElseThrow().getLastActivityAt().isAfter(Instant.now().minusSeconds(5)));
        age(31);
        assertThrows(BadCredentialsException.class, () -> activity.record(sid, "idle_regression"));
        mvc.perform(post("/api/v1/auth/activity").header("Authorization", "Bearer " + access)
            .header("X-Requested-With", "XMLHttpRequest")).andExpect(status().isUnauthorized());
    }

    @Test void exactThirtyMinuteBoundaryExpires() {
        Instant now = Instant.parse("2026-10-19T00:00:00Z");
        var service = new SessionActivityService(sessions, Clock.fixed(now, ZoneOffset.UTC));
        var session = new RefreshSession();
        session.setLastActivityAt(now.minusSeconds(1800).plusMillis(1));
        assertDoesNotThrow(() -> service.requireActive(session));
        session.setLastActivityAt(now.minusSeconds(1800));
        assertThrows(BadCredentialsException.class, () -> service.requireActive(session));
    }
}
