package com.nbh.erp.config;

import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final com.nbh.erp.role.repository.PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.security.initial-admin.username:admin}")
    private String adminUsername;

    @Value("${app.security.initial-admin.password:admin123}")
    private String adminPassword;

    @Value("${app.security.initial-admin.email:admin@nbh.com}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Checking system initialization...");

        if (!userRepository.existsByUsername(adminUsername)) {
            log.info("No super-admin user found. Initializing administrator: '{}'...", adminUsername);

            Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                    .orElseGet(() -> {
                        Role newRole = Role.builder()
                                .name("ROLE_ADMIN")
                                .description("Super Administrator with full system privileges")
                                .build();
                        return roleRepository.save(newRole);
                    });

            User adminUser = User.builder()
                    .username(adminUsername)
                    .password(passwordEncoder.encode(adminPassword))
                    .email(adminEmail)
                    .fullName("System Administrator")
                    .phone("+94 11 000 0000")
                    .isActive(true)
                    .approvalStatus("APPROVED")
                    .roles(Set.of(adminRole))
                    .build();
            adminUser.setCreatedBy("system");
            adminUser.setUpdatedBy("system");

            userRepository.save(adminUser);
            log.info("Administrator '{}' initialized successfully. (For deployment, configure INITIAL_ADMIN_PASSWORD env var)", adminUsername);
        } else {
            userRepository.findByUsername(adminUsername).ifPresent(admin -> {
                if (!"APPROVED".equals(admin.getApprovalStatus()) || !Boolean.TRUE.equals(admin.getIsActive())) {
                    admin.setApprovalStatus("APPROVED");
                    admin.setIsActive(true);
                    userRepository.save(admin);
                }
            });
            log.info("Administrator user '{}' is already present and active.", adminUsername);
        }

        // Guarantee that ROLE_ADMIN possesses 100% of all available system permissions
        roleRepository.findByName("ROLE_ADMIN").ifPresent(adminRole -> {
            java.util.List<com.nbh.erp.role.entity.Permission> allPermissions = permissionRepository.findAll();
            if (adminRole.getPermissions() == null || adminRole.getPermissions().size() < allPermissions.size()) {
                adminRole.setPermissions(new java.util.HashSet<>(allPermissions));
                roleRepository.save(adminRole);
                log.info("Synchronized {} system permissions to ROLE_ADMIN.", allPermissions.size());
            }
        });
    }
}
