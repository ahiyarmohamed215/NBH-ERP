package com.nbh.erp;

import com.nbh.erp.auth.controller.AuthController;
import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.service.*;
import com.nbh.erp.common.handler.GlobalExceptionHandler;
import com.nbh.erp.user.entity.User;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LoginFailureSecurityTest {
    final org.springframework.security.authentication.AuthenticationManager manager=mock(org.springframework.security.authentication.AuthenticationManager.class);
    final com.nbh.erp.user.repository.UserRepository users=mock(com.nbh.erp.user.repository.UserRepository.class);
    final org.springframework.security.crypto.password.PasswordEncoder encoder=mock(org.springframework.security.crypto.password.PasswordEncoder.class);
    final com.nbh.erp.security.jwt.JwtTokenProvider tokens=mock(com.nbh.erp.security.jwt.JwtTokenProvider.class);
    final com.nbh.erp.auth.repository.RefreshSessionRepository sessions=mock(com.nbh.erp.auth.repository.RefreshSessionRepository.class);
    final LoginProtection protection=spy(new LoginProtection());
    final AuthService service=new AuthService(manager,tokens,users,encoder,sessions,mock(SessionActivityService.class),
            mock(com.nbh.erp.role.repository.PermissionRepository.class),protection);
    MockMvc mvc;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.standaloneSetup(new AuthController(service,mock(SessionActivityService.class),mock(AuthCookieService.class),tokens))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    User account() {
        User user=User.builder().username("operator").email("operator@example.test").password("unused")
                .isActive(true).approvalStatus("APPROVED").roles(new HashSet<>()).build();
        user.setId(71L); return user;
    }
    @Test void unknownWrongPasswordInactivePendingRejectedAndCooldownShareTheSameHttpContract() throws Exception {
        User candidate=account();
        when(manager.authenticate(any())).thenThrow(new BadCredentialsException("provider detail must not escape"));
        for(String status:List.of("UNKNOWN","APPROVED","INACTIVE","PENDING","REJECTED","COOLDOWN","APPROVED")) {
            candidate.setApprovalStatus(status.equals("INACTIVE")?"APPROVED":status);
            candidate.setIsActive(!status.equals("INACTIVE"));
            when(users.findByUsernameOrEmailWithRolesAndPermissions("operator"))
                    .thenReturn(status.equals("UNKNOWN")?Optional.empty():Optional.of(candidate));
            mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                    .content("{\"username\":\"operator\",\"password\":\"test-input-only\"}"))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Invalid username or password"))
                    .andExpect(jsonPath("$.errorCode").value("INVALID_CREDENTIALS"))
                    .andExpect(header().doesNotExist("Set-Cookie"));
        }
        verifyNoInteractions(tokens,sessions);
    }
    @Test void usernameEmailAndCaseVariantsConsumeTheSameAccountBudget() {
        User candidate=account();
        when(users.findByUsernameOrEmailWithRolesAndPermissions(anyString())).thenReturn(Optional.of(candidate));
        when(manager.authenticate(any())).thenThrow(new BadCredentialsException("Invalid"));
        for(String alias:List.of("operator","OPERATOR","operator@example.test","OPERATOR@example.test","operator","operator@example.test")) {
            assertThrows(BadCredentialsException.class,()->service.login(new LoginRequest(alias,"test-input-only")));
        }
        verify(manager,times(5)).authenticate(any());
        verify(encoder,times(1)).matches(eq("test-input-only"),anyString());
        verifyNoInteractions(tokens,sessions);
    }
    @Test void failedLoginAuditNeverIncludesIdentifiersPasswordOrProviderMessage() {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(AuthService.class);
        var capture=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        capture.start(); logger.addAppender(capture);
        try {
            assertThrows(BadCredentialsException.class,()->service.login(new LoginRequest("untrusted-name\nforged", "never-log-this")));
            assertFalse(capture.list.isEmpty());
            for(var event:capture.list) {
                assertEquals("login outcome=denied",event.getFormattedMessage());
            }
        } finally { logger.detachAppender(capture); capture.stop(); }
    }
    @Test void randomUnknownIdentifiersCannotFillTheRealAccountCooldownCache() {
        for(int i=0;i<25;i++) {
            assertThrows(BadCredentialsException.class,()->service.login(new LoginRequest(UUID.randomUUID().toString(),"test-input-only")));
        }
        verify(protection,never()).beginAccount(anyString());
        User candidate=account();
        when(users.findByUsernameOrEmailWithRolesAndPermissions("operator")).thenReturn(Optional.of(candidate));
        when(manager.authenticate(any())).thenThrow(new BadCredentialsException("Invalid"));
        assertThrows(BadCredentialsException.class,()->service.login(new LoginRequest("operator","test-input-only")));
        verify(protection).beginAccount("user:71");
    }
}
