package com.nbh.erp.role.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.role.dto.CreateRoleRequest;
import com.nbh.erp.role.dto.PermissionDto;
import com.nbh.erp.role.dto.RoleDto;
import com.nbh.erp.role.dto.UpdateRoleRequest;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(RoleDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(PermissionDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public RoleDto createRole(CreateRoleRequest request) {
        String roleName = request.getName().trim().toUpperCase().replace(" ", "_");
        if (!roleName.startsWith("ROLE_")) {
            roleName = "ROLE_" + roleName;
        }

        if (roleRepository.findByName(roleName).isPresent()) {
            throw new BusinessException("Role '" + roleName + "' already exists.");
        }

        Set<Permission> permissions = new HashSet<>();
        if (request.getPermissions() != null) {
            for (String permName : request.getPermissions()) {
                permissionRepository.findByName(permName)
                        .ifPresent(permissions::add);
            }
        }

        Role role = Role.builder()
                .name(roleName)
                .description(request.getDescription())
                .permissions(permissions)
                .build();

        Role saved = roleRepository.save(role);
        log.info("Created new custom role: {}", saved.getName());
        return RoleDto.from(saved);
    }

    @Transactional
    public RoleDto updateRole(Long id, UpdateRoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", id));

        role.setDescription(request.getDescription());

        if (request.getPermissions() != null) {
            Set<Permission> permissions = new HashSet<>();
            for (String permName : request.getPermissions()) {
                permissionRepository.findByName(permName)
                        .ifPresent(permissions::add);
            }
            role.setPermissions(permissions);
        }

        Role updated = roleRepository.save(role);
        log.info("Updated role: {}", updated.getName());
        return RoleDto.from(updated);
    }

    @Transactional
    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", id));

        if ("ROLE_ADMIN".equalsIgnoreCase(role.getName())) {
            throw new BusinessException("Cannot delete super administrator role.");
        }

        roleRepository.delete(role);
        log.info("Deleted role: {}", role.getName());
    }
}
