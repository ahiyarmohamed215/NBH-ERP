package com.nbh.erp.user.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.user.dto.CreateUserRequest;
import com.nbh.erp.user.dto.UpdateUserRequest;
import com.nbh.erp.user.dto.UserDto;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PagedResponse<UserDto> getAllUsers(Pageable pageable) {
        Page<UserDto> page = userRepository.findAll(pageable).map(UserDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        return UserDto.from(user);
    }

    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateResourceException("User", "username", request.getUsername());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User", "email", request.getEmail());
        }

        Set<Role> roles = new HashSet<>();
        for (String roleName : request.getRoles()) {
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));
            SecurityUtils.checkRoleGrant(role);
                    roles.add(role);
        }

        User user = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .email(request.getEmail())
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .isActive(true)
                .approvalStatus("APPROVED")
                .roles(roles)
                .build();

        User savedUser = userRepository.save(user);
        return UserDto.from(savedUser);
    }

    @Transactional
    public UserDto updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        SecurityUtils.enforceCanEdit("USER", "Employee: " + user.getUsername());
        SecurityUtils.protectUser(user);
        user.setTokenVersion(user.getTokenVersion() + 1);

        userRepository.findByEmail(request.getEmail())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new DuplicateResourceException("User", "email", request.getEmail());
                    }
                });

        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPhone(request.getPhone());

        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }

        if (StringUtils.hasText(request.getPassword())) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : request.getRoles()) {
                String cleanName = roleName != null ? roleName.trim() : "";
                if (!cleanName.isEmpty()) {
                    Role role = roleRepository.findByName(cleanName)
                            .or(() -> roleRepository.findByName("ROLE_" + cleanName))
                            .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));
                    SecurityUtils.checkRoleGrant(role);
                    roles.add(role);
                }
            }
            if (!roles.isEmpty()) {
                user.setRoles(roles);
            }
        }

        User updatedUser = userRepository.save(user);

        auditLogService.log("USER_UPDATE", "EMPLOYEES", "User", updatedUser.getUsername(),
                String.format("Updated employee profile for '%s' (%s)", updatedUser.getFullName(), updatedUser.getUsername()));

        return UserDto.from(updatedUser);
    }

    @Transactional
    public void toggleUserActive(Long id) {
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        SecurityUtils.enforceCanEdit("USER", "Employee: " + user.getUsername());
        SecurityUtils.protectUser(user);
        user.setTokenVersion(user.getTokenVersion() + 1);

        user.setIsActive(!user.getIsActive());
        userRepository.save(user);

        auditLogService.log("USER_STATUS", "EMPLOYEES", "User", user.getUsername(),
                String.format("Set user '%s' active status to %s", user.getUsername(), user.getIsActive()));
    }

    @Transactional(readOnly = true)
    public PagedResponse<UserDto> getPendingUsers(Pageable pageable) {
        Page<UserDto> page = userRepository.findByApprovalStatus("PENDING", pageable).map(UserDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public long getPendingUsersCount() {
        return userRepository.countByApprovalStatus("PENDING");
    }

    @Transactional
    public UserDto approveUser(Long id, com.nbh.erp.user.dto.ApproveUserRequest request) {
        if (request == null) {
            request = new com.nbh.erp.user.dto.ApproveUserRequest();
        }
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        SecurityUtils.enforceCanEdit("USER", "Employee: " + user.getUsername());
        SecurityUtils.protectUser(user);
        user.setTokenVersion(user.getTokenVersion() + 1);

        if (StringUtils.hasText(request.getFullName())) {
            user.setFullName(request.getFullName().trim());
        }
        if (StringUtils.hasText(request.getPhone())) {
            user.setPhone(request.getPhone().trim());
        }
        if (StringUtils.hasText(request.getEmail())) {
            String newEmail = request.getEmail().trim();
            userRepository.findByEmail(newEmail)
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(id)) {
                            throw new DuplicateResourceException("User", "email", newEmail);
                        }
                    });
            user.setEmail(newEmail);
        }
        if (StringUtils.hasText(request.getEmployeeCode())) {
            user.setEmployeeCode(request.getEmployeeCode().trim());
        }

        if (request.getRoles() != null) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : request.getRoles()) {
                String cleanName = roleName != null ? roleName.trim() : "";
                if (!cleanName.isEmpty()) {
                    Role role = roleRepository.findByName(cleanName)
                            .or(() -> roleRepository.findByName("ROLE_" + cleanName))
                            .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));
                    SecurityUtils.checkRoleGrant(role);
                    roles.add(role);
                }
            }
            user.setRoles(roles);
        }

        user.setApprovalStatus("APPROVED");
        user.setIsActive(true);

        User approvedUser = userRepository.save(user);

        auditLogService.log(
                "USER_APPROVE",
                "EMPLOYEES",
                "User",
                user.getUsername(),
                String.format("User '%s' approved with roles: %s", user.getUsername(), request.getRoles() != null ? request.getRoles() : "None")
        );

        return UserDto.from(approvedUser);
    }

    @Transactional
    public UserDto rejectUser(Long id) {
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        SecurityUtils.enforceCanEdit("USER", "Employee: " + user.getUsername());
        SecurityUtils.protectUser(user);
        user.setTokenVersion(user.getTokenVersion() + 1);

        user.setApprovalStatus("REJECTED");
        user.setIsActive(false);

        User rejectedUser = userRepository.save(user);

        auditLogService.log(
                "USER_REJECT",
                "EMPLOYEES",
                "User",
                user.getUsername(),
                String.format("User '%s' registration rejected", user.getUsername())
        );

        return UserDto.from(rejectedUser);
    }

    @Transactional
    public void deleteUser(Long id) {
        SecurityUtils.enforceNoDelete("User", id);
    }

    @Transactional(readOnly = true)
    public java.util.List<UserDto> getActiveUsers() {
        return userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()) && "APPROVED".equalsIgnoreCase(u.getApprovalStatus()))
                .map(UserDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public java.util.List<UserDto> getPosStaff() {
        return userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()) && "APPROVED".equalsIgnoreCase(u.getApprovalStatus()))
                .filter(u -> {
                    boolean isPrivileged = u.getRoles().stream().anyMatch(r -> {
                        String name = r.getName().toUpperCase();
                        return name.contains("ADMIN") || name.contains("SUPER") || name.contains("MANAGER") || name.contains("DIRECTOR") || name.contains("CASHIER") || name.contains("POS") || name.contains("SALES");
                    });
                    if (isPrivileged) return true;
                    return u.getRoles().stream().anyMatch(r ->
                            r.getPermissions() != null && r.getPermissions().stream().anyMatch(p ->
                                    "SALES_CREATE".equalsIgnoreCase(p.getName()) || "SALES".equalsIgnoreCase(p.getModule())
                            )
                    );
                })
                .map(UserDto::from)
                .toList();
    }
}
