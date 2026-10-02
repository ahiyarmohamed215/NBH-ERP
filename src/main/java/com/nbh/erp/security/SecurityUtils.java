package com.nbh.erp.security;

import com.nbh.erp.common.exception.BusinessException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collection;
import java.util.Collections;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

public final class SecurityUtils {

    private SecurityUtils() {}

    public static Optional<String> getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            return Optional.empty();
        }
        return Optional.of(authentication.getName());
    }

    public static Optional<Long> getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return Optional.of(principal.getId());
        }
        return Optional.empty();
    }

    public static Optional<UserPrincipal> getCurrentUserPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return Optional.of(principal);
        }
        return Optional.empty();
    }

    public static String getCurrentUserFullName() {
        return getCurrentUserPrincipal()
                .map(UserPrincipal::getFullName)
                .filter(name -> name != null && !name.isBlank())
                .orElseGet(() -> getCurrentUsername().orElse("System"));
    }

    public static Set<String> getCurrentUserAuthorities() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Collections.emptySet();
        }
        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();
        if (authorities == null) {
            return Collections.emptySet();
        }
        return authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    public static boolean hasRole(String roleName) {
        String target = roleName.startsWith("ROLE_") ? roleName : "ROLE_" + roleName;
        return getCurrentUserAuthorities().contains(target);
    }

    public static boolean hasAuthority(String authorityName) {
        return getCurrentUserAuthorities().contains(authorityName);
    }

    /**
     * Determines whether the current authenticated staff member has permission to edit records.
     * Only authorized management staff (Super Admin, Admin, Manager, or users with module management permissions)
     * are permitted to edit records.
     */
    public static boolean canEdit(String module) {
        Set<String> authorities = getCurrentUserAuthorities();
        if (authorities.isEmpty()) {
            return false;
        }

        // Super Admin or Admin can always edit
        if (authorities.contains("ROLE_SUPER_ADMIN") || authorities.contains("ROLE_ADMIN") || authorities.contains("ROLE_MANAGER")) {
            return true;
        }

        // Module-specific edit authorities
        if (module != null && !module.isBlank()) {
            String upper = module.toUpperCase();
            if (authorities.contains(upper + "_MANAGE") || authorities.contains(upper + "_EDIT") || authorities.contains(upper + "_PROCESS")) {
                return true;
            }
        }

        // Explicit edit authority
        if (authorities.contains("CAN_EDIT") || authorities.contains("RECORD_EDIT") || authorities.contains("USER_MANAGE")) {
            return true;
        }

        return false;
    }

    /**
     * Enforces edit permission. Throws AccessDeniedException if the user is not authorized.
     */
    public static void enforceCanEdit(String module, String recordName) {
        if (!canEdit(module)) {
            String staff = getCurrentUsername().orElse("Current user");
            throw new AccessDeniedException(
                    "Access Denied: Staff member '" + staff + "' does not have permission to edit " +
                    (recordName != null ? recordName : "records") +
                    ". Only authorized management personnel can edit existing records in NBH ERP."
            );
        }
    }

    /**
     * Enforces ERP compliance rule: records cannot be deleted once created.
     */
    public static void enforceNoDelete(String entityName, Object entityId) {
        throw new BusinessException(
                "Permanent deletion of " + entityName + (entityId != null ? " (ID: " + entityId + ")" : "") +
                " is strictly prohibited in NBH ERP. Once added, records are preserved for audit and compliance. " +
                "Please deactivate or change the record status instead."
        );
    }
}
