package com.nbh.erp;

import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.HashSet;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class AdministratorPrincipalSecurityTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    User user(String name) {
        return User.builder().id(1L).username(name).isActive(true).approvalStatus("APPROVED")
                .roles(new HashSet<>()).build();
    }

    @ParameterizedTest @ValueSource(strings={"admin","ADMIN","aDmIn"})
    void administratorNameNeverGrantsPrivileges(String name) {
        User account=user(name);
        var principal=UserPrincipal.create(account);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));
        assertTrue(principal.getAuthorities().isEmpty());
        assertFalse(SecurityUtils.isSuperAdmin());
        assertFalse(SecurityUtils.isSuperAdmin(account));
        assertFalse(SecurityUtils.isAdministrator());
        assertFalse(SecurityUtils.canEdit("USER"));
    }

    @Test void storedRoleDoesNotBypassAccountState() {
        User account=user("operator");
        account.getRoles().add(Role.builder().name("ROLE_SUPER_ADMIN").build());
        account.setIsActive(false);
        assertFalse(UserPrincipal.create(account).isEnabled());
        account.setIsActive(true);
        account.setApprovalStatus("PENDING");
        assertFalse(UserPrincipal.create(account).isEnabled());
        account.setApprovalStatus("REJECTED");
        assertFalse(UserPrincipal.create(account).isEnabled());
        account.setApprovalStatus("APPROVED");
        account.setDeletedAt(java.time.LocalDateTime.now());
        assertFalse(UserPrincipal.create(account).isEnabled());
    }

    @Test void onlyActiveAssignedRolesAndTheirStoredPermissionsAreGranted() {
        User account=user("operator");
        Role role=Role.builder().name("ROLE_SUPER_ADMIN").permissions(new HashSet<>(Set.of(
                Permission.builder().name("PRODUCT_VIEW").build()))).build();
        account.getRoles().add(role);
        var principal=UserPrincipal.create(account);
        assertTrue(principal.isEnabled());
        assertEquals(Set.of("ROLE_SUPER_ADMIN"),Set.copyOf(principal.getRoles()));
        assertEquals(Set.of("PRODUCT_VIEW"),Set.copyOf(principal.getPermissions()));
        role.setStatus("INACTIVE");
        assertTrue(UserPrincipal.create(account).getAuthorities().isEmpty());
        role.setStatus("ACTIVE");
        account.getRoles().clear();
        assertTrue(UserPrincipal.create(account).getAuthorities().isEmpty());
    }

    @Test void legacySuperAdministratorRoleIsACanonicalAliasWithoutExtraRoleGrants() {
        User account=user("operator");
        account.getRoles().add(Role.builder().name("SUPER_ADMIN").build());
        var principal=UserPrincipal.create(account);
        assertTrue(principal.getRoles().contains("ROLE_SUPER_ADMIN"));
        assertFalse(principal.getRoles().contains("ROLE_ADMIN"));
    }
}
