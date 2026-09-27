package com.nbh.erp.config;

import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.security.initial-admin.enabled:true}")
    private boolean initialAdminEnabled;

    @Value("${app.security.initial-admin.username:admin}")
    private String adminUsername;

    @Value("${app.security.initial-admin.password:admin123}")
    private String adminPassword;

    @Value("${app.security.initial-admin.email:admin@nbh.com}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        log.info("Checking system authorization & permissions initialization...");

        // 1. Seed system permissions (required for @PreAuthorize and frontend Role permission builder)
        Map<String, Permission> permissionMap = seedPermissions();

        // 2. Seed only Super Admin and Enterprise Admin roles with all permissions
        Set<Permission> allPermissions = new HashSet<>(permissionMap.values());
        Role superAdminRole = seedRole("ROLE_SUPER_ADMIN", "Full unrestricted access across all ERP features", allPermissions);
        Role adminRole = seedRole("ROLE_ADMIN", "Enterprise Administrator with all management permissions", allPermissions);

        // 3. Seed Super Admin User if enabled and absent
        if (initialAdminEnabled) {
            seedSuperAdminUser(superAdminRole, adminRole);
        } else {
            log.info("Initial super admin user creation is disabled via configuration (initial-admin.enabled=false).");
        }

        log.info("System initialization completed successfully.");
    }

    private record PermItem(String module, String name, String description) {}

    private Map<String, Permission> seedPermissions() {
        List<PermItem> defs = List.of(
                new PermItem("USER", "USER_VIEW", "View user accounts and profiles"),
                new PermItem("USER", "USER_MANAGE", "Create, edit, approve, and deactivate system users"),
                new PermItem("ROLE", "ROLE_VIEW", "View roles and assigned permissions"),
                new PermItem("ROLE", "ROLE_MANAGE", "Create and modify roles and permission sets"),
                new PermItem("WAREHOUSE", "WAREHOUSE_VIEW", "View warehouse facilities and locations"),
                new PermItem("WAREHOUSE", "WAREHOUSE_MANAGE", "Create and manage warehouses"),
                new PermItem("PRODUCT", "PRODUCT_VIEW", "View product catalog, pricing, and specs"),
                new PermItem("PRODUCT", "PRODUCT_MANAGE", "Create, edit, and deactivate products"),
                new PermItem("BRAND", "BRAND_VIEW", "View product brand listings"),
                new PermItem("BRAND", "BRAND_MANAGE", "Create, edit, and manage product brands"),
                new PermItem("CATEGORY", "CATEGORY_VIEW", "View product categories"),
                new PermItem("CATEGORY", "CATEGORY_MANAGE", "Create and manage categories"),
                new PermItem("SUPPLIER", "SUPPLIER_VIEW", "View supplier records and contacts"),
                new PermItem("SUPPLIER", "SUPPLIER_MANAGE", "Create and manage suppliers"),
                new PermItem("CUSTOMER", "CUSTOMER_VIEW", "View customer master and credit limits"),
                new PermItem("CUSTOMER", "CUSTOMER_MANAGE", "Create, edit, and manage customers"),
                new PermItem("INVENTORY", "INVENTORY_VIEW", "View stock balances across warehouses"),
                new PermItem("INVENTORY", "INVENTORY_MANAGE", "Manage inventory movements and stocks"),
                new PermItem("INVENTORY", "INVENTORY_ADJUST", "Perform and approve stock count adjustments"),
                new PermItem("GRN", "GRN_VIEW", "View Goods Received Notes from suppliers"),
                new PermItem("GRN", "GRN_PROCESS", "Create and process incoming GRNs into stock"),
                new PermItem("GTN", "GTN_VIEW", "View Goods Transfer Notes between warehouses"),
                new PermItem("GTN", "GTN_PROCESS", "Process inter-warehouse inventory transfers"),
                new PermItem("PRN", "PRN_VIEW", "View Purchase Return Notes to suppliers"),
                new PermItem("PRN", "PRN_PROCESS", "Process returns and decrease stock to suppliers"),
                new PermItem("SALES", "SALES_CREATE", "Issue POS customer invoices and bills"),
                new PermItem("SALES", "SALES_VIEW", "View sales invoices and transaction histories"),
                new PermItem("SALES", "SALES_VIEW_ALL", "View sales invoices across all branches and cashiers"),
                new PermItem("SALES", "SALES_VOID", "Void completed invoices and restore inventory"),
                new PermItem("SALES", "SALES_RETURN", "Process customer returns and issue credit notes"),
                new PermItem("QUOTATION", "QUOTATION_VIEW", "View customer sales quotations"),
                new PermItem("QUOTATION", "QUOTATION_MANAGE", "Create, edit, delete, and convert quotations to invoices"),
                new PermItem("PAYMENT", "PAYMENT_CREATE", "Record customer invoice payments"),
                new PermItem("PAYMENT", "PAYMENT_VIEW", "View payment receipts and transaction records"),
                new PermItem("REPORT", "REPORT_VIEW", "Access business analytics, sales, and inventory reports"),
                new PermItem("AUDIT", "AUDIT_VIEW", "View system security and data change audit logs"),
                new PermItem("DASHBOARD", "DASHBOARD_VIEW", "View management dashboard and KPI metrics")
        );

        Map<String, Permission> permissionMap = new HashMap<>();

        for (PermItem perm : defs) {
            Permission p = permissionRepository.findByName(perm.name())
                    .orElseGet(() -> permissionRepository.save(
                            Permission.builder()
                                    .name(perm.name())
                                    .module(perm.module())
                                    .description(perm.description())
                                    .createdAt(LocalDateTime.now())
                                    .updatedAt(LocalDateTime.now())
                                    .build()
                    ));
            permissionMap.put(perm.name(), p);
        }

        return permissionMap;
    }

    private Role seedRole(String roleName, String description, Set<Permission> permissions) {
        Role role = roleRepository.findByName(roleName).orElse(null);
        if (role == null) {
            role = Role.builder()
                    .name(roleName)
                    .description(description)
                    .permissions(new HashSet<>(permissions))
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            role = roleRepository.save(role);
            log.info("Initialized system role: {}", roleName);
        } else {
            // Ensure permissions are up to date
            if (role.getPermissions() == null) {
                role.setPermissions(new HashSet<>());
            }
            role.getPermissions().addAll(permissions);
            role = roleRepository.save(role);
        }
        return role;
    }

    private void seedSuperAdminUser(Role superAdminRole, Role adminRole) {
        if (userRepository.findByUsername(adminUsername).isEmpty()) {
            Set<Role> roles = new HashSet<>();
            roles.add(superAdminRole);
            roles.add(adminRole);

            User superAdmin = User.builder()
                    .username(adminUsername)
                    .password(passwordEncoder.encode(adminPassword))
                    .email(adminEmail)
                    .fullName("System Super Administrator")
                    .phone("+94 11 000 0000")
                    .employeeCode("ADM-001")
                    .commissionRate(java.math.BigDecimal.ZERO)
                    .approvalStatus("APPROVED")
                    .isActive(true)
                    .roles(roles)
                    .build();

            userRepository.save(superAdmin);
            log.info("Initialized default Super Admin user: '{}' with full ERP privileges.", adminUsername);
        }
    }
}
