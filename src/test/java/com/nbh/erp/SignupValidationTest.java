package com.nbh.erp;

import com.nbh.erp.auth.dto.SignupRequest;
import com.nbh.erp.auth.repository.RefreshSessionRepository;
import com.nbh.erp.auth.service.AuthService;
import com.nbh.erp.auth.service.SessionActivityService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.validation.PasswordValidator;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SignupValidationTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private RefreshSessionRepository refreshSessions;

    @Mock
    private SessionActivityService sessionActivity;

    @Mock
    private PermissionRepository permissionRepository;

    private AuthService authService;

    @BeforeEach
    void setup() {
        authService = new AuthService(
                authenticationManager,
                tokenProvider,
                userRepository,
                passwordEncoder,
                refreshSessions,
                sessionActivity,
                permissionRepository, new com.nbh.erp.auth.service.LoginProtection()
        );
    }

    @Test
    @DisplayName("PasswordValidator correctly enforces strong password criteria")
    void testPasswordValidatorCriteria() {
        // Valid strong passwords
        assertDoesNotThrow(() -> PasswordValidator.validate("SuperSecure#2026", "john", "john@example.com"));
        assertDoesNotThrow(() -> PasswordValidator.validate("K!9mX$wL7qP", "alex", "alex@corp.com"));

        // Too short (< 8 chars)
        BusinessException exShort = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("Sh0rt!", "user", "user@example.com"));
        assertTrue(exShort.getMessage().contains("at least 8 characters"));

        // Missing uppercase
        BusinessException exUpper = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("lowercase123!", "user", "user@example.com"));
        assertTrue(exUpper.getMessage().contains("uppercase letter"));

        // Missing lowercase
        BusinessException exLower = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("UPPERCASE123!", "user", "user@example.com"));
        assertTrue(exLower.getMessage().contains("lowercase letter"));

        // Missing digit
        BusinessException exDigit = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("NoDigitsHere!", "user", "user@example.com"));
        assertTrue(exDigit.getMessage().contains("number"));

        // Missing special char
        BusinessException exSpecial = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("NoSpecialChar123", "user", "user@example.com"));
        assertTrue(exSpecial.getMessage().contains("special character"));

        // Password containing username
        BusinessException exUsername = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("ValidUser#2026", "validuser", "other@example.com"));
        assertTrue(exUsername.getMessage().contains("cannot contain your username"));

        // Password containing email prefix
        BusinessException exEmail = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("CorporateSecret#2026", "random", "corporatesecret@example.com"));
        assertTrue(exEmail.getMessage().contains("parts of your email"));

        // Known breached password
        BusinessException exBreached = assertThrows(BusinessException.class,
                () -> PasswordValidator.validate("Password123!", "random", "other@example.com"));
        assertTrue(exBreached.getMessage().contains("breached") || exBreached.getMessage().contains("common"));
    }

    @Test
    @DisplayName("Signup successfully registers valid user and normalizes phone number")
    void testSignupSuccess() {
        when(userRepository.existsByUsernameIgnoreCase("newuser")).thenReturn(false);
        when(userRepository.findByEmailIgnoreCase("newuser@example.com")).thenReturn(Optional.empty());
        when(userRepository.findMatchingPhone(anyString(), anyString(), anyString())).thenReturn(Collections.emptyList());
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encodedpasswordhash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SignupRequest request = new SignupRequest(
                "newuser",
                "StrongPass#2026",
                "StrongPass#2026",
                "newuser@example.com",
                "New User",
                "+94 77 123 4567"
        );

        authService.signup(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(captor.capture());

        User saved = captor.getValue();
        assertEquals("newuser", saved.getUsername());
        assertEquals("newuser@example.com", saved.getEmail());
        assertEquals("+94771234567", saved.getPhone(), "Phone should be normalized to E.164");
        assertEquals("PENDING", saved.getApprovalStatus());
        assertFalse(saved.getIsActive());
    }

    @Test
    @DisplayName("Signup rejects duplicate username")
    void testDuplicateUsername() {
        when(userRepository.existsByUsernameIgnoreCase("existinguser")).thenReturn(true);

        SignupRequest request = new SignupRequest(
                "existinguser",
                "StrongPass#2026",
                "StrongPass#2026",
                "user@example.com",
                "Full Name",
                "+94 77 123 4567"
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> authService.signup(request));
        assertTrue(ex.getMessage().contains("already registered"));
    }

    @Test
    @DisplayName("Signup rejects duplicate email")
    void testDuplicateEmail() {
        when(userRepository.existsByUsernameIgnoreCase("brandnewuser")).thenReturn(false);
        when(userRepository.findByEmailIgnoreCase("taken@example.com")).thenReturn(Optional.of(new User()));

        SignupRequest request = new SignupRequest(
                "brandnewuser",
                "StrongPass#2026",
                "StrongPass#2026",
                "taken@example.com",
                "Full Name",
                "+94 77 123 4567"
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> authService.signup(request));
        assertTrue(ex.getMessage().contains("email address is already registered"));
    }

    @Test
    @DisplayName("Signup rejects duplicate phone number")
    void testDuplicatePhone() {
        when(userRepository.existsByUsernameIgnoreCase("brandnewuser")).thenReturn(false);
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.empty());
        when(userRepository.findMatchingPhone(anyString(), anyString(), anyString())).thenReturn(List.of(new User()));

        SignupRequest request = new SignupRequest(
                "brandnewuser",
                "StrongPass#2026",
                "StrongPass#2026",
                "user@example.com",
                "Full Name",
                "+94 77 123 4567"
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> authService.signup(request));
        assertTrue(ex.getMessage().contains("phone number is already registered"));
    }

    @Test
    @DisplayName("Signup rejects password mismatch and invalid inputs")
    void testInvalidInputs() {
        // Password mismatch
        SignupRequest mismatch = new SignupRequest(
                "brandnewuser",
                "StrongPass#2026",
                "DifferentPass#2026",
                "user@example.com",
                "Full Name",
                "+94 77 123 4567"
        );
        BusinessException exMismatch = assertThrows(BusinessException.class, () -> authService.signup(mismatch));
        assertTrue(exMismatch.getMessage().contains("do not match"));

        // Invalid phone number
        SignupRequest badPhone = new SignupRequest(
                "brandnewuser",
                "StrongPass#2026",
                "StrongPass#2026",
                "user@example.com",
                "Full Name",
                "not-a-number"
        );
        BusinessException exBadPhone = assertThrows(BusinessException.class, () -> authService.signup(badPhone));
        assertTrue(exBadPhone.getMessage().contains("valid contact number"));
    }
}
