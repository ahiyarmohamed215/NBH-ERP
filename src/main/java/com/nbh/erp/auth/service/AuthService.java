package com.nbh.erp.auth.service;

import com.nbh.erp.auth.dto.*;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.nbh.erp.auth.repository.RefreshSessionRepository refreshSessions;
    private final SessionActivityService sessionActivity;
    private final com.nbh.erp.role.repository.PermissionRepository permissionRepository;

    @Transactional
    public void signup(SignupRequest request) {
        if (request == null) {
            throw new BusinessException("Registration details are required.");
        }

        String trimmedUsername = request.getUsername() != null ? request.getUsername().trim() : "";
        String trimmedFullName = request.getFullName() != null ? request.getFullName().trim() : "";
        String trimmedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase(java.util.Locale.ROOT) : "";
        String rawPhone = request.getPhone() != null ? request.getPhone().trim() : "";
        String password = request.getPassword() != null ? request.getPassword() : "";
        String confirmPassword = request.getConfirmPassword();

        // 1. Username validation
        if (trimmedUsername.isEmpty()) {
            throw new BusinessException("Username is required.");
        }
        if (trimmedUsername.length() < 3 || trimmedUsername.length() > 50) {
            throw new BusinessException("Username must be between 3 and 50 characters.");
        }
        if (!trimmedUsername.matches("^[a-zA-Z0-9._-]+$")) {
            throw new BusinessException("Username can only contain letters, numbers, dots, hyphens, and underscores.");
        }

        // 2. Full Name validation
        if (trimmedFullName.isEmpty()) {
            throw new BusinessException("Full name is required.");
        }
        if (trimmedFullName.length() < 2 || trimmedFullName.length() > 100) {
            throw new BusinessException("Full name must be between 2 and 100 characters.");
        }

        // 3. Email validation
        if (trimmedEmail.isEmpty()) {
            throw new BusinessException("Email address is required.");
        }
        if (trimmedEmail.length() > 100 || !trimmedEmail.matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new BusinessException("Enter a valid email address.");
        }

        // 4. Phone validation & normalization
        if (rawPhone.isEmpty()) {
            throw new BusinessException("Phone number is required.");
        }
        com.nbh.erp.common.validation.PhoneValidator phoneValidator = new com.nbh.erp.common.validation.PhoneValidator();
        if (!phoneValidator.isValid(rawPhone, null)) {
            throw new BusinessException("Enter a valid contact number (e.g. +94 77 123 4567).");
        }
        String normalizedPhone;
        try {
            normalizedPhone = com.nbh.erp.common.validation.PhoneValidator.normalize(rawPhone);
        } catch (Exception ex) {
            normalizedPhone = rawPhone;
        }

        // 5. Password & Confirm Password validation
        if (password.isEmpty()) {
            throw new BusinessException("Password is required.");
        }
        if (confirmPassword != null && !password.equals(confirmPassword)) {
            throw new BusinessException("Passwords do not match.");
        }
        com.nbh.erp.common.validation.PasswordValidator.validate(password, trimmedUsername, trimmedEmail);

        // 6. Uniqueness checks: Username, Email, Phone
        if (userRepository.existsByUsernameIgnoreCase(trimmedUsername)) {
            throw new BusinessException("Username '" + trimmedUsername + "' is already registered. Please choose another username.");
        }

        if (userRepository.findByEmailIgnoreCase(trimmedEmail).isPresent()) {
            throw new BusinessException("This email address is already registered. If you already have an account, please sign in or use a different email address.");
        }

        String cleanDigits = rawPhone.replaceAll("[^0-9]", "");
        List<User> phoneMatches = userRepository.findMatchingPhone(rawPhone, normalizedPhone, cleanDigits);
        if (!phoneMatches.isEmpty()) {
            throw new BusinessException("This phone number is already registered. Please use a different phone number and try again.");
        }

        // 7. Persist new user pending approval
        User user = User.builder()
                .username(trimmedUsername)
                .password(passwordEncoder.encode(password))
                .email(trimmedEmail)
                .fullName(trimmedFullName)
                .phone(normalizedPhone != null ? normalizedPhone : rawPhone)
                .isActive(false) // Inactive until approved by administrator
                .approvalStatus("PENDING")
                .roles(new HashSet<>())
                .build();
        user.setCreatedBy(trimmedUsername);
        user.setUpdatedBy(trimmedUsername);

        userRepository.save(user);
        user.setEmployeeCode(user.getEmployeeCode());
        userRepository.save(user);
        log.info("New user registered and pending approval: '{}' (email: {}, phone: {})", user.getUsername(), user.getEmail(), user.getPhone());
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String usernameOrEmail = request.getUsername() != null ? request.getUsername().trim() : "";

        // Pre-check user status using single fetch join query to provide specific error messages
        User candidateUser = userRepository.findByUsernameOrEmailWithRolesAndPermissions(usernameOrEmail)
                .orElse(null);

        if (candidateUser == null) {
            throw new BusinessException("Username is incorrect.");
        }

        boolean isSuperAdmin = "admin".equalsIgnoreCase(candidateUser.getUsername()) ||
                (candidateUser.getRoles() != null && candidateUser.getRoles().stream().anyMatch(r ->
                        "ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));

        if (!isSuperAdmin) {
            if ("PENDING".equalsIgnoreCase(candidateUser.getApprovalStatus())) {
                throw new BusinessException("Your account is pending administrator approval. Please contact your system admin.");
            }
            if ("REJECTED".equalsIgnoreCase(candidateUser.getApprovalStatus())) {
                throw new BusinessException("Your account registration request has been rejected. Please contact support.");
            }
            if (Boolean.FALSE.equals(candidateUser.getIsActive())) {
                throw new BusinessException("Your account is deactivated. Please contact an administrator.");
            }
        } else {
            // Self-heal: ensure super admin is permanently active and approved in DB
            if (!Boolean.TRUE.equals(candidateUser.getIsActive()) || !"APPROVED".equals(candidateUser.getApprovalStatus())) {
                candidateUser.setIsActive(true);
                candidateUser.setApprovalStatus("APPROVED");
                userRepository.save(candidateUser);
                log.info("Auto-restored active and approved status for super administrator '{}'", candidateUser.getUsername());
            }
        }

        if (!passwordEncoder.matches(request.getPassword(), candidateUser.getPassword())) {
            throw new BusinessException("Password is incorrect.");
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(candidateUser.getUsername(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();

        String refreshToken = newRefreshSession(userPrincipal);
        String accessToken = tokenProvider.generateAccessToken(authentication, tokenProvider.claims(refreshToken).get("sid", String.class));

        isSuperAdmin = "admin".equalsIgnoreCase(userPrincipal.getUsername()) ||
                userPrincipal.getAuthorities().stream().anyMatch(a ->
                        "ROLE_SUPER_ADMIN".equalsIgnoreCase(a.getAuthority()) || "SUPER_ADMIN".equalsIgnoreCase(a.getAuthority()));

        List<String> roles = new ArrayList<>(userPrincipal.getRoles());
        if (isSuperAdmin && !roles.contains("ROLE_SUPER_ADMIN")) {
            roles.add("ROLE_SUPER_ADMIN");
        }

        List<String> permissions = isSuperAdmin
                ? permissionRepository.findAll().stream().map(com.nbh.erp.role.entity.Permission::getName).distinct().collect(Collectors.toList())
                : userPrincipal.getPermissions();

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .id(userPrincipal.getId())
                .username(userPrincipal.getUsername())
                .email(userPrincipal.getEmail())
                .fullName(userPrincipal.getFullName())
                .roles(roles)
                .permissions(permissions)
                .build();
    }

    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        return refreshToken(request != null ? request.getRefreshToken() : null);
    }

    @Transactional
    public LoginResponse refreshToken(String refreshToken) {
        if (refreshToken == null || !tokenProvider.validateToken(refreshToken, "REFRESH")) {
            throw new org.springframework.security.authentication.BadCredentialsException("Invalid or expired refresh token");
        }

        String username = tokenProvider.getUsernameFromToken(refreshToken);
        User user = userRepository.findByUsernameOrEmailWithRolesAndPermissions(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        UserPrincipal principal = UserPrincipal.create(user);
        if (!principal.isEnabled() || !tokenProvider.matchesVersion(refreshToken, user.getTokenVersion()))
            throw new org.springframework.security.authentication.BadCredentialsException("Session expired");
        var claims = tokenProvider.claims(refreshToken);
        var session = refreshSessions.lockById(claims.get("sid", String.class))
            .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Session expired"));
        if (!session.getUsername().equals(username) || !session.getTokenId().equals(claims.getId()) || session.getExpiresAt().isBefore(java.time.Instant.now()))
            throw new org.springframework.security.authentication.BadCredentialsException("Refresh token already used or expired");
        sessionActivity.requireActive(session);
        session.setTokenId(java.util.UUID.randomUUID().toString());
        session.setExpiresAt(java.time.Instant.now().plusMillis(tokenProvider.getRefreshMs()));
        refreshSessions.save(session);
        String rotated = tokenProvider.generateRefreshToken(username, user.getTokenVersion(), session.getId(), session.getTokenId());
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        String newAccessToken = tokenProvider.generateAccessToken(authentication, session.getId());

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(rotated)
                .id(principal.getId())
                .username(principal.getUsername())
                .email(principal.getEmail())
                .fullName(principal.getFullName())
                .roles(principal.getRoles())
                .permissions(principal.getPermissions())
                .build();
    }

    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            throw new BusinessException("User is not authenticated");
        }

        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();

        return UserProfileDto.builder()
                .id(principal.getId())
                .username(principal.getUsername())
                .email(principal.getEmail())
                .fullName(principal.getFullName())
                .phone(principal.getPhone())
                .isActive(principal.isEnabled())
                .roles(principal.getRoles())
                .permissions(principal.getPermissions())
                .build();
    }

    @Transactional
    public UserProfileDto updateCurrentUserProfile(UpdateProfileRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            throw new BusinessException("User is not authenticated");
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        // Check if email already used by someone else
        userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(user.getId())) {
                        throw new BusinessException("Email '" + request.getEmail() + "' is already in use by another account.");
                    }
                });

        user.setFullName(request.getFullName().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPhone(request.getPhone() != null ? request.getPhone().trim() : null);

        // Password change if supplied
        if (org.springframework.util.StringUtils.hasText(request.getNewPassword())) {
            if (!org.springframework.util.StringUtils.hasText(request.getCurrentPassword())) {
                throw new BusinessException("Current password is required to set a new password.");
            }
            if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
                throw new BusinessException("Current password does not match.");
            }
            if (request.getNewPassword().length() < 6) {
                throw new BusinessException("New password must be at least 6 characters.");
            }
            user.setPassword(passwordEncoder.encode(request.getNewPassword()));
            user.setTokenVersion(user.getTokenVersion() + 1);
        }

        User saved = userRepository.save(user);
        log.info("User '{}' updated profile successfully", username);

        List<String> roles = saved.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());

        List<String> permissions = saved.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(p -> p.getName())
                .distinct()
                .collect(Collectors.toList());

        return UserProfileDto.builder()
                .id(saved.getId())
                .username(saved.getUsername())
                .email(saved.getEmail())
                .fullName(saved.getFullName())
                .phone(saved.getPhone())
                .isActive(saved.getIsActive())
                .roles(roles)
                .permissions(permissions)
                .build();
    }
    private String newRefreshSession(UserPrincipal principal) {
        var session = new com.nbh.erp.auth.entity.RefreshSession();
        session.setId(java.util.UUID.randomUUID().toString());
        session.setTokenId(java.util.UUID.randomUUID().toString());
        session.setUsername(principal.getUsername());
        session.setTokenVersion(principal.getTokenVersion());
        session.setExpiresAt(java.time.Instant.now().plusMillis(tokenProvider.getRefreshMs()));
        refreshSessions.save(session);
        return tokenProvider.generateRefreshToken(principal.getUsername(), principal.getTokenVersion(), session.getId(), session.getTokenId());
    }
    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && tokenProvider.validateToken(refreshToken, "REFRESH")) {
            try {
                var claims = tokenProvider.claims(refreshToken);
                String sessionId = claims.get("sid", String.class);
                if (sessionId != null) {
                    refreshSessions.deleteById(sessionId);
                    log.info("Revoked refresh session '{}' on logout", sessionId);
                }
                String username = claims.getSubject();
                if (username != null) {
                    userRepository.findByUsername(username).ifPresent(u -> {
                        u.setTokenVersion(u.getTokenVersion() + 1);
                        userRepository.save(u);
                        log.info("Incremented token version for user '{}' on cookie-based logout", username);
                    });
                }
            } catch (Exception e) {
                log.warn("Could not revoke refresh session during logout: {}", e.getMessage());
            }
        }

        try {
            var currentUsername = com.nbh.erp.security.SecurityUtils.getCurrentUsername();
            if (currentUsername.isPresent()) {
                userRepository.findByUsername(currentUsername.get()).ifPresent(user -> {
                    user.setTokenVersion(user.getTokenVersion() + 1);
                    userRepository.save(user);
                    log.info("Incremented token version for principal '{}' on logout", user.getUsername());
                });
            }
        } catch (Exception e) {
            log.debug("No active security context during logout: {}", e.getMessage());
        }
    }

    @Transactional
    public void logout() {
        logout(null);
    }
    @Transactional
    public String requestPasswordReset(com.nbh.erp.auth.dto.ForgotPasswordRequest request) {
        if (request == null || !org.springframework.util.StringUtils.hasText(request.getUsernameOrEmail())) {
            throw new BusinessException("Username or registered email is required.");
        }
        String input = request.getUsernameOrEmail().trim();
        User user = userRepository.findByUsernameOrEmailWithRolesAndPermissions(input)
                .orElseThrow(() -> new BusinessException("No registered account found matching '" + input + "'."));

        user.setPasswordResetRequested(true);
        user.setPasswordResetNotes("Reset requested by user on " + java.time.LocalDateTime.now());
        userRepository.save(user);

        // Mask email for privacy (e.g. j***n@domain.com)
        String email = user.getEmail() != null ? user.getEmail() : "";
        String masked = email;
        int atIdx = email.indexOf('@');
        if (atIdx > 2) {
            masked = email.charAt(0) + "***" + email.charAt(atIdx - 1) + email.substring(atIdx);
        } else if (atIdx > 0) {
            masked = email.charAt(0) + "***" + email.substring(atIdx);
        }
        log.info("Password reset request logged for user '{}' (email: {})", user.getUsername(), user.getEmail());
        return masked;
    }

}