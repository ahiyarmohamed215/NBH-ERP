package com.nbh.erp.user.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.user.dto.CreateUserRequest;
import com.nbh.erp.user.dto.UpdateUserRequest;
import com.nbh.erp.user.dto.UserDto;
import com.nbh.erp.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "User administration APIs")
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Get paginated list of all users")
    public ResponseEntity<ApiResponse<PagedResponse<UserDto>>> getAllUsers(@PageableDefault(size = 20) Pageable pageable) {
        PagedResponse<UserDto> response = userService.getAllUsers(pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Get single user by ID")
    public ResponseEntity<ApiResponse<UserDto>> getUserById(@PathVariable Long id) {
        UserDto user = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Create a new user")
    public ResponseEntity<ApiResponse<UserDto>> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDto created = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("User created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Update an existing user")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        UserDto updated = userService.updateUser(id, request);
        return ResponseEntity.ok(ApiResponse.ok("User updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Toggle user active status")
    public ResponseEntity<ApiResponse<Void>> toggleUserActive(@PathVariable Long id) {
        userService.toggleUserActive(id);
        return ResponseEntity.ok(ApiResponse.ok("User status toggled successfully", null));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Get paginated list of pending user approval requests")
    public ResponseEntity<ApiResponse<PagedResponse<UserDto>>> getPendingUsers(@PageableDefault(size = 20) Pageable pageable) {
        PagedResponse<UserDto> response = userService.getPendingUsers(pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Approve pending user registration and assign roles")
    public ResponseEntity<ApiResponse<UserDto>> approveUser(
            @PathVariable Long id,
            @Valid @RequestBody com.nbh.erp.user.dto.ApproveUserRequest request
    ) {
        UserDto approved = userService.approveUser(id, request);
        return ResponseEntity.ok(ApiResponse.ok("User registration approved successfully", approved));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Reject pending user registration")
    public ResponseEntity<ApiResponse<UserDto>> rejectUser(@PathVariable Long id) {
        UserDto rejected = userService.rejectUser(id);
        return ResponseEntity.ok(ApiResponse.ok("User registration rejected", rejected));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')")
    @Operation(summary = "Delete an existing user")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.ok("User deleted successfully", null));
    }
}
