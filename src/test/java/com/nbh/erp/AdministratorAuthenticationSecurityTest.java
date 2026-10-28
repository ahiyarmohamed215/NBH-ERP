package com.nbh.erp;

import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.dto.LoginResponse;
import com.nbh.erp.auth.dto.SignupRequest;
import com.nbh.erp.auth.service.AuthService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @Transactional
class AdministratorAuthenticationSecurityTest {
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtTokenProvider tokens;
    @Autowired WebApplicationContext context;
    @Autowired com.nbh.erp.user.service.UserService userService;
    @MockitoSpyBean PasswordEncoder passwords;
    MockMvc mvc;
    String raw;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        raw="Q!7v"+UUID.randomUUID().toString().replace("-","");
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    User account(String username) {
        return users.saveAndFlush(User.builder().username(username).email(UUID.randomUUID()+"@example.test")
                .fullName("Security test account").password(passwords.encode(raw)).isActive(true).approvalStatus("APPROVED")
                .roles(new HashSet<>(Set.of(roles.findByName("ROLE_SUPER_ADMIN").orElseThrow()))).build());
    }
    LoginRequest request(User account) { var r=new LoginRequest();r.setUsername(account.getUsername());r.setPassword(raw);return r; }
    LoginResponse login(User account) { return auth.login(request(account)); }
    void me(String bearer,int expected) throws Exception {
        SecurityContextHolder.clearContext();
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+bearer)).andExpect(status().is(expected));
    }

    @ParameterizedTest @ValueSource(strings={"admin","ADMIN","aDmIn"})
    void signupOfAdministratorNameRemainsPendingAndCannotLogin(String name) {
        auth.signup(new SignupRequest(name,raw,"new-owner@example.test","New Account","+94771234567"));
        User saved=users.findByUsername(name).orElseThrow();
        assertFalse(saved.getIsActive());
        assertEquals("PENDING",saved.getApprovalStatus());
        assertTrue(saved.getRoles().isEmpty());
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->login(saved));
        assertFalse(saved.getIsActive());
        assertTrue(saved.getRoles().isEmpty());
    }

    @ParameterizedTest @ValueSource(strings={"admin","different-owner"})
    void suspendedSuperAdministratorCannotLoginRefreshOrReuseAccessToken(String name) throws Exception {
        User account=account(name);
        LoginResponse issued=login(account);
        account.setIsActive(false);users.saveAndFlush(account);
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->login(account));
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->auth.refreshToken(issued.getRefreshToken()));
        me(issued.getAccessToken(),401);
        assertFalse(account.getIsActive());
    }

    @ParameterizedTest @ValueSource(strings={"PENDING","REJECTED"})
    void superAdministratorRoleCannotOverrideApprovalStatus(String approval) throws Exception {
        User account=account("admin");
        LoginResponse issued=login(account);
        account.setApprovalStatus(approval);users.saveAndFlush(account);
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->login(account));
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->auth.refreshToken(issued.getRefreshToken()));
        me(issued.getAccessToken(),401);
        assertEquals(approval,account.getApprovalStatus());
    }

    @Test void removingRolesRevokesExistingTokenPrivilegesAndDoesNotRegainThemOnRefresh() throws Exception {
        User account=account("admin");
        LoginResponse issued=login(account);
        account.getRoles().clear();users.saveAndFlush(account);
        SecurityContextHolder.clearContext();
        mvc.perform(get("/api/v1/users").header("Authorization","Bearer "+issued.getAccessToken())).andExpect(status().isForbidden());
        LoginResponse refreshed=auth.refreshToken(issued.getRefreshToken());
        assertTrue(refreshed.getRoles().isEmpty());
        assertTrue(refreshed.getPermissions().isEmpty());
        LoginResponse signedIn=login(account);
        assertTrue(signedIn.getRoles().isEmpty());
        assertTrue(signedIn.getPermissions().isEmpty());
    }

    @Test void disabledRoleAndRemovedPermissionsAreRespectedInLoginAndRefresh() {
        User account=account("operator");
        var role=account.getRoles().iterator().next();
        role.getPermissions().clear();roles.saveAndFlush(role);
        LoginResponse issued=login(account);
        assertTrue(issued.getPermissions().isEmpty());
        role.setStatus("INACTIVE");roles.saveAndFlush(role);
        var refreshed=auth.refreshToken(issued.getRefreshToken());
        assertTrue(refreshed.getRoles().isEmpty());
        assertTrue(refreshed.getPermissions().isEmpty());
    }

    @Test void validLoginUsesOnePasswordVerificationAndReturnsTheStoredGrants() {
        User account=account("operator");
        clearInvocations(passwords);
        var result=login(account);
        verify(passwords,times(1)).matches(raw,account.getPassword());
        assertNotNull(result.getAccessToken());
        assertEquals(Set.of("ROLE_SUPER_ADMIN"),Set.copyOf(result.getRoles()));
        assertEquals(43,result.getPermissions().size());
    }

    @Test void unrelatedProfileEditCannotReactivateOrApproveASuspendedSuperAdministrator() {
        User target=account("suspended-owner");
        target.setIsActive(false);target.setApprovalStatus("REJECTED");users.saveAndFlush(target);
        User actor=account("authorized-owner");
        var principal=UserPrincipal.create(actor);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));
        var request=new com.nbh.erp.user.dto.UpdateUserRequest();
        request.setEmail(target.getEmail());request.setFullName("Updated profile");
        userService.updateUser(target.getId(),request);
        assertFalse(target.getIsActive());
        assertEquals("REJECTED",target.getApprovalStatus());
        SecurityContextHolder.clearContext();
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->login(target));
    }

    @Test void wrongPasswordKeepsTheExistingErrorAndDoesNotAuthenticate() throws Exception {
        User account=account("operator");
        clearInvocations(passwords);
        LoginRequest invalid=request(account);invalid.setPassword(UUID.randomUUID().toString());
        var failure=assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->auth.login(invalid));
        assertEquals("Invalid username or password",failure.getMessage());
        verify(passwords,times(1)).matches(invalid.getPassword(),account.getPassword());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(invalid)))
                .andExpect(status().isUnauthorized());
    }
}
