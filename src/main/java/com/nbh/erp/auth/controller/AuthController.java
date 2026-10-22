package com.nbh.erp.auth.controller;

import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.auth.dto.LoginResponse;
import com.nbh.erp.auth.dto.RefreshTokenRequest;
import com.nbh.erp.auth.dto.UserProfileDto;
import com.nbh.erp.auth.service.AuthCookieService;
import com.nbh.erp.auth.service.AuthService;
import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Authentication & User Session APIs")
public class AuthController {

    private final AuthService authService;
    private final com.nbh.erp.auth.service.SessionActivityService sessionActivity;
    private final AuthCookieService cookieService;
    private final JwtTokenProvider tokenProvider;

    @PostMapping("/signup")
    @Operation(summary = "Register new user account (pending administrator approval)")
    public ResponseEntity<ApiResponse<String>> signup(@Valid @RequestBody com.nbh.erp.auth.dto.SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.ok("Registration submitted successfully! Your account is pending administrator approval.", null));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate user and issue JWT tokens")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        LoginResponse response = authService.login(request);
        String rawRefreshToken = response.getRefreshToken();
        if (rawRefreshToken != null) {
            cookieService.setRefreshCookie(httpResponse, httpRequest, rawRefreshToken, tokenProvider.getRefreshMs());
            response.setRefreshToken(null); // Never return refresh token in JSON response body
        }
        return ResponseEntity.ok(ApiResponse.ok("Authentication successful", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token using refresh token cookie or request body")
    public ResponseEntity<ApiResponse<LoginResponse>> refreshToken(
            @RequestBody(required = false) RefreshTokenRequest request,
            @CookieValue(name = AuthCookieService.REFRESH_COOKIE_NAME, required = false) String cookieRefreshToken,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {

        String tokenToUse = null;
        if (cookieRefreshToken != null && !cookieRefreshToken.isBlank()) {
            tokenToUse = cookieRefreshToken.trim();
        } else if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            tokenToUse = request.getRefreshToken().trim();
        }

        if (tokenToUse == null) {
            throw new BadCredentialsException("No refresh token provided");
        }

        LoginResponse response = authService.refreshToken(tokenToUse);
        String rotatedRefreshToken = response.getRefreshToken();
        if (rotatedRefreshToken != null) {
            cookieService.setRefreshCookie(httpResponse, httpRequest, rotatedRefreshToken, tokenProvider.getRefreshMs());
            response.setRefreshToken(null); // Never return refresh token in JSON response body
        }
        return ResponseEntity.ok(ApiResponse.ok("Token refreshed successfully", response));
    }

    @PostMapping("/logout")
    @Operation(summary = "Sign out and revoke refresh session")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = AuthCookieService.REFRESH_COOKIE_NAME, required = false) String cookieRefreshToken,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        authService.logout(cookieRefreshToken);
        cookieService.clearRefreshCookie(httpResponse, httpRequest);
        return ResponseEntity.ok(ApiResponse.ok("Signed out successfully", null));
    }

    @PostMapping("/activity")
    public ResponseEntity<ApiResponse<Void>> activity(HttpServletRequest request, java.security.Principal principal) {
        String token = request.getHeader("Authorization").substring(7);
        sessionActivity.record(tokenProvider.claims(token).get("sid", String.class), principal.getName());
        return ResponseEntity.ok(ApiResponse.ok("Activity recorded", null));
    }

    @GetMapping("/csrf")
    @Operation(summary = "CSRF health check and token verification")
    public ResponseEntity<ApiResponse<Map<String, String>>> getCsrf() {
        return ResponseEntity.ok(ApiResponse.ok("CSRF protection active", Map.of("status", "UP")));
    }

    @GetMapping("/me")
    @Operation(summary = "Get currently authenticated user details and permissions")
    public ResponseEntity<ApiResponse<UserProfileDto>> getCurrentUser() {
        UserProfileDto profile = authService.getCurrentUserProfile();
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    @PutMapping("/profile")
    @Operation(summary = "Update currently authenticated user profile")
    public ResponseEntity<ApiResponse<UserProfileDto>> updateProfile(
            @Valid @RequestBody com.nbh.erp.auth.dto.UpdateProfileRequest request
    ) {
        UserProfileDto updated = authService.updateCurrentUserProfile(request);
        return ResponseEntity.ok(ApiResponse.ok("Profile updated successfully", updated));
    }
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(@jakarta.validation.Valid @RequestBody com.nbh.erp.auth.dto.ForgotPasswordRequest request) {
        String maskedEmail = authService.requestPasswordReset(request);
        return ResponseEntity.ok(ApiResponse.ok(
                "Password reset request submitted. An administrator has been notified to reset your password and send it to your registered email (" + maskedEmail + ").",
                maskedEmail
        ));
    }

}