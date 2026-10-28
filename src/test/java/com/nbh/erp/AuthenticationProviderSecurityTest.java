package com.nbh.erp;

import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import com.nbh.erp.auth.service.AuthService;
import com.nbh.erp.auth.service.SessionActivityService;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.*;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationProviderSecurityTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtTokenProvider tokenProvider;
    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock RefreshSessionRepository refreshSessions;
    @Mock SessionActivityService activity;
    @Mock PermissionRepository permissions;
    @Spy com.nbh.erp.auth.service.LoginProtection protection = new com.nbh.erp.auth.service.LoginProtection();
    @InjectMocks AuthService service;
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    static Stream<AuthenticationException> accountFailures() {
        return Stream.of(new LockedException("Locked"),new DisabledException("Disabled"),
                new AccountExpiredException("Expired"),new CredentialsExpiredException("Credentials expired"));
    }
    @ParameterizedTest @MethodSource("accountFailures")
    void providerAccountDecisionsAreNotBypassedOrReclassified(AuthenticationException failure) {
        User account=User.builder().username("admin").isActive(true).approvalStatus("APPROVED").build();
        when(userRepository.findByUsernameOrEmailWithRolesAndPermissions("admin")).thenReturn(Optional.of(account));
        when(authenticationManager.authenticate(any())).thenThrow(failure);
        LoginRequest request=new LoginRequest();request.setUsername("admin");request.setPassword(UUID.randomUUID().toString());
        assertEquals("Invalid username or password",assertThrows(BadCredentialsException.class,()->service.login(request)).getMessage());
        verify(authenticationManager,times(1)).authenticate(any());
        verifyNoInteractions(passwordEncoder,refreshSessions,tokenProvider);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        assertTrue(account.getIsActive());
        assertEquals("APPROVED",account.getApprovalStatus());
    }
}
