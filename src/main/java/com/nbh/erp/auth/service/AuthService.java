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
    private final com.nbh.erp.role.repository.PermissionRepository permissionRepository;

    @Transactional
    public void signup(SignupRequest request) {
        String trimmedUsername = request.getUsername() != null ? request.getUsername().trim() : "";
        String trimmedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";

        if (trimmedUsername.isEmpty() || trimmedEmail.isEmpty()) {
            throw new BusinessException("Username and email are required.");
        }

        java.util.Optional<User> userByUsername = userRepository.findByUsernameIgnoreCase(trimmedUsername);
        java.util.Optional<User> userByEmail = userRepository.findByEmailIgnoreCase(trimmedEmail);

        if (userByUsername.isPresent() && userByEmail.isPresent()
                && !userByUsername.get().getId().equals(userByEmail.get().getId())) {
            throw new BusinessException("Username '" + trimmedUsername + "' and email '" + trimmedEmail + "' are already registered to different accounts. Please use different credentials or sign in.");
        }

        User existingUser = userByUsername.orElse(userByEmail.orElse(null));

        if (existingUser != null) {
            if ("REJECTED".equalsIgnoreCase(existingUser.getApprovalStatus())) {
                // If the user was rejected earlier, allow them to re-apply with new/updated credentials
                existingUser.setUsername(trimmedUsername);
                existingUser.setEmail(trimmedEmail);
                existingUser.setFullName(request.getFullName().trim());
                existingUser.setPhone(request.getPhone() != null ? request.getPhone().trim() : null);
                existingUser.setPassword(passwordEncoder.encode(request.getPassword()));
                existingUser.setIsActive(false);
                existingUser.setApprovalStatus("PENDING");
                existingUser.setUpdatedBy(trimmedUsername);
                userRepository.save(existingUser);
                log.info("Previously rejected user re-submitted registration pending approval: '{}'", trimmedUsername);
                return;
            } else if ("PENDING".equalsIgnoreCase(existingUser.getApprovalStatus())) {
                String matchedField = userByUsername.isPresent()
                        ? "Username '" + trimmedUsername + "'"
                        : "Email '" + trimmedEmail + "'";
                throw new BusinessException(matchedField + " is already submitted and pending administrator approval. Please wait for review or contact your administrator.");
            } else {
                if (userByUsername.isPresent()) {
                    throw new BusinessException("Username '" + trimmedUsername + "' is already registered. Please sign in or choose another username.");
                } else {
                    throw new BusinessException("Email '" + trimmedEmail + "' is already registered. Please sign in or use another email.");
                }
            }
        }

        User user = User.builder()
                .username(trimmedUsername)
                .password(passwordEncoder.encode(request.getPassword()))
                .email(trimmedEmail)
                .fullName(request.getFullName().trim())
                .phone(request.getPhone() != null ? request.getPhone().trim() : null)
                .isActive(false) // Inactive until approved by administrator
                .approvalStatus("PENDING")
                .roles(new HashSet<>())
                .build();
        user.setCreatedBy(trimmedUsername);
        user.setUpdatedBy(trimmedUsername);

        userRepository.save(user);
        log.info("New user registered and pending approval: '{}'", user.getUsername());
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        // Pre-check user status to provide helpful error message if pending or rejected
        User candidateUser = userRepository.findByUsername(request.getUsername())
                .or(() -> userRepository.findByEmail(request.getUsername()))
                .orElse(null);

        if (candidateUser != null) {
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
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();

        String accessToken = tokenProvider.generateAccessToken(authentication);
        String refreshToken = newRefreshSession(userPrincipal);

        User user = userRepository.findById(userPrincipal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userPrincipal.getId()));

        boolean isSuperAdmin = "admin".equalsIgnoreCase(user.getUsername()) ||
                (user.getRoles() != null && user.getRoles().stream().anyMatch(r ->
                        "ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));

        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());

        if (isSuperAdmin && !roles.contains("ROLE_SUPER_ADMIN")) {
            roles.add("ROLE_SUPER_ADMIN");
        }

        List<String> permissions = isSuperAdmin
                ? permissionRepository.findAll().stream().map(p -> p.getName()).distinct().collect(Collectors.toList())
                : user.getRoles().stream()
                        .flatMap(r -> r.getPermissions().stream())
                        .map(p -> p.getName())
                        .distinct()
                        .collect(Collectors.toList());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(roles)
                .permissions(permissions)
                .build();
    }

    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        if (!tokenProvider.validateToken(request.getRefreshToken(), "REFRESH")) {
            throw new org.springframework.security.authentication.BadCredentialsException("Invalid or expired refresh token");
        }

        String username = tokenProvider.getUsernameFromToken(request.getRefreshToken());
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        UserPrincipal principal = UserPrincipal.create(user);
        if (!principal.isEnabled() || !tokenProvider.matchesVersion(request.getRefreshToken(), user.getTokenVersion()))
            throw new org.springframework.security.authentication.BadCredentialsException("Session expired");
        var claims = tokenProvider.claims(request.getRefreshToken());
        var session = refreshSessions.lockById(claims.get("sid", String.class))
            .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Session expired"));
        if (!session.getUsername().equals(username) || !session.getTokenId().equals(claims.getId()) || session.getExpiresAt().isBefore(java.time.Instant.now()))
            throw new org.springframework.security.authentication.BadCredentialsException("Refresh token already used or expired");
        session.setTokenId(java.util.UUID.randomUUID().toString());
        session.setExpiresAt(java.time.Instant.now().plusMillis(tokenProvider.getRefreshMs()));
        refreshSessions.save(session);
        String rotated = tokenProvider.generateRefreshToken(username, user.getTokenVersion(), session.getId(), session.getTokenId());
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        String newAccessToken = tokenProvider.generateAccessToken(authentication);

        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(p -> p.getName())
                .distinct()
                .collect(Collectors.toList());

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(rotated)
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(roles)
                .permissions(permissions)
                .build();
    }

    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            throw new BusinessException("User is not authenticated");
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(p -> p.getName())
                .distinct()
                .collect(Collectors.toList());

        return UserProfileDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .isActive(user.getIsActive())
                .roles(roles)
                .permissions(permissions)
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
    public void logout() {
        String username = com.nbh.erp.security.SecurityUtils.getCurrentUsername().orElseThrow();
        User user = userRepository.findByUsername(username).orElseThrow();
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }
}
