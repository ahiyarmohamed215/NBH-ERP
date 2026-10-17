package com.nbh.erp.security;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.nbh.erp.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Getter
@Builder
@AllArgsConstructor
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    @JsonIgnore
    private final String password;
    private final String email;
    private final String fullName;
    private final String phone;
    private final boolean active;
    private final long tokenVersion;
    private final java.util.List<String> roles;
    private final java.util.List<String> permissions;
    private final Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal create(User user) {
        boolean isSuperAdmin = "admin".equalsIgnoreCase(user.getUsername()) ||
                (user.getRoles() != null && user.getRoles().stream().anyMatch(r ->
                        "ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));

        Set<GrantedAuthority> authorities = new HashSet<>();
        Set<String> roleNames = new HashSet<>();
        Set<String> permissionNames = new HashSet<>();

        if (user.getRoles() != null) {
            user.getRoles().forEach(role -> {
                authorities.add(new SimpleGrantedAuthority(role.getName()));
                roleNames.add(role.getName());
                if (role.getPermissions() != null) {
                    role.getPermissions().forEach(permission -> {
                        authorities.add(new SimpleGrantedAuthority(permission.getName()));
                        permissionNames.add(permission.getName());
                    });
                }
            });
        }

        if (isSuperAdmin) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            roleNames.add("ROLE_SUPER_ADMIN");
            roleNames.add("ROLE_ADMIN");
        }

        java.util.List<String> sortedRoles = roleNames.stream().sorted().toList();
        java.util.List<String> sortedPermissions = permissionNames.stream().sorted().toList();

        return UserPrincipal.builder()
                .id(user.getId())
                .username(user.getUsername())
                .password(user.getPassword())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .active(isSuperAdmin || (Boolean.TRUE.equals(user.getIsActive()) && "APPROVED".equals(user.getApprovalStatus())))
                .tokenVersion(user.getTokenVersion())
                .roles(sortedRoles)
                .permissions(sortedPermissions)
                .authorities(authorities)
                .build();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
