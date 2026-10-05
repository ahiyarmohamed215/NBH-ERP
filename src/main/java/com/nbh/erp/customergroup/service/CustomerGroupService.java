package com.nbh.erp.customergroup.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customergroup.dto.CreateCustomerGroupRequest;
import com.nbh.erp.customergroup.dto.CustomerGroupDto;
import com.nbh.erp.customergroup.entity.CustomerGroup;
import com.nbh.erp.customergroup.repository.CustomerGroupRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerGroupService {

    private final CustomerGroupRepository customerGroupRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<CustomerGroupDto> getAllGroups() {
        return customerGroupRepository.findAll().stream().map(group -> {
            List<Long> custIds = customerRepository.findByCustomerGroupId(group.getId()).stream()
                    .map(com.nbh.erp.customer.entity.Customer::getId)
                    .toList();
            return CustomerGroupDto.from(group, custIds);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerGroupDto> getActiveGroups() {
        return customerGroupRepository.findByIsActiveTrue().stream().map(group -> {
            List<Long> custIds = customerRepository.findByCustomerGroupId(group.getId()).stream()
                    .map(com.nbh.erp.customer.entity.Customer::getId)
                    .toList();
            return CustomerGroupDto.from(group, custIds);
        }).toList();
    }

    @Transactional(readOnly = true)
    public CustomerGroupDto getGroupById(Long id) {
        CustomerGroup group = customerGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", id));
        List<Long> custIds = customerRepository.findByCustomerGroupId(group.getId()).stream()
                .map(com.nbh.erp.customer.entity.Customer::getId)
                .toList();
        return CustomerGroupDto.from(group, custIds);
    }

    @Transactional
    public CustomerGroupDto createGroup(CreateCustomerGroupRequest request) {
        String code = request.getEffectiveCode();
        if (!StringUtils.hasText(code)) {
            code = "GRP-" + String.format("%03d", customerGroupRepository.count() + 1);
        } else {
            code = code.trim().toUpperCase();
        }

        if (customerGroupRepository.existsByGroupCode(code)) {
            throw new DuplicateResourceException("CustomerGroup", "code", code);
        }

        User assignedStaff = null;
        Long staffId = request.getEffectiveStaffId();
        if (staffId != null) {
            assignedStaff = userRepository.findById(staffId).orElse(null);
        }

        String name = request.getEffectiveName();
        if (!StringUtils.hasText(name)) {
            name = "Group " + code;
        }

        CustomerGroup group = CustomerGroup.builder()
                .groupCode(code)
                .groupName(name.trim())
                .description(request.getDescription())
                .assignedStaff(assignedStaff)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        CustomerGroup saved = customerGroupRepository.save(group);

        if (request.getCustomerIds() != null && !request.getCustomerIds().isEmpty()) {
            customerRepository.findAllById(request.getCustomerIds()).forEach(c -> {
                c.getCustomerGroups().add(saved);
                if (c.getCustomerGroup() == null) {
                    c.setCustomerGroup(saved);
                }
            });
        }

        auditLogService.log(
                "CUSTOMER_GROUP_CREATE",
                "CustomerGroup",
                saved.getGroupCode(),
                String.format("Customer group '%s' created with code '%s'", saved.getGroupName(), saved.getGroupCode())
        );

        List<Long> custIds = customerRepository.findByCustomerGroupId(saved.getId()).stream()
                .map(com.nbh.erp.customer.entity.Customer::getId)
                .toList();
        return CustomerGroupDto.from(saved, custIds);
    }

    @Transactional
    public CustomerGroupDto updateGroup(Long id, CreateCustomerGroupRequest request) {
        CustomerGroup group = customerGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", id));

        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Group: " + group.getGroupName());

        String code = request.getEffectiveCode();
        if (StringUtils.hasText(code)) {
            String newCode = code.trim().toUpperCase();
            if (!newCode.equals(group.getGroupCode()) && customerGroupRepository.existsByGroupCode(newCode)) {
                throw new DuplicateResourceException("CustomerGroup", "code", newCode);
            }
            group.setGroupCode(newCode);
        }

        String name = request.getEffectiveName();
        if (StringUtils.hasText(name)) {
            group.setGroupName(name.trim());
        }

        group.setDescription(request.getDescription());

        Long staffId = request.getEffectiveStaffId();
        if (staffId != null) {
            User assignedStaff = userRepository.findById(staffId).orElse(null);
            group.setAssignedStaff(assignedStaff);
        } else {
            group.setAssignedStaff(null);
        }

        if (request.getIsActive() != null) {
            group.setIsActive(request.getIsActive());
        }

        CustomerGroup saved = customerGroupRepository.save(group);

        if (request.getCustomerIds() != null) {
            customerRepository.findByCustomerGroupId(saved.getId()).forEach(c -> {
                if (!request.getCustomerIds().contains(c.getId())) {
                    c.getCustomerGroups().removeIf(g -> g.getId().equals(saved.getId()));
                    if (c.getCustomerGroup() != null && c.getCustomerGroup().getId().equals(saved.getId())) {
                        c.setCustomerGroup(c.getCustomerGroups().isEmpty() ? null : c.getCustomerGroups().iterator().next());
                    }
                }
            });
            customerRepository.findAllById(request.getCustomerIds()).forEach(c -> {
                c.getCustomerGroups().add(saved);
                if (c.getCustomerGroup() == null) {
                    c.setCustomerGroup(saved);
                }
            });
        }

        auditLogService.log(
                "CUSTOMER_GROUP_UPDATE",
                "CustomerGroup",
                saved.getGroupCode(),
                String.format("Customer group '%s' updated", saved.getGroupName())
        );

        List<Long> custIds = customerRepository.findByCustomerGroupId(saved.getId()).stream()
                .map(com.nbh.erp.customer.entity.Customer::getId)
                .toList();
        return CustomerGroupDto.from(saved, custIds);
    }

    @Transactional
    public CustomerGroupDto toggleActive(Long id) {
        CustomerGroup group = customerGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", id));

        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Group: " + group.getGroupName());

        group.setIsActive(!Boolean.TRUE.equals(group.getIsActive()));
        CustomerGroup saved = customerGroupRepository.save(group);

        auditLogService.log(
                "CUSTOMER_GROUP_TOGGLE_ACTIVE",
                "CustomerGroup",
                group.getGroupCode(),
                String.format("Customer group '%s' active status changed to %s", group.getGroupName(), group.getIsActive())
        );

        List<Long> custIds = customerRepository.findByCustomerGroupId(saved.getId()).stream()
                .map(com.nbh.erp.customer.entity.Customer::getId)
                .toList();
        return CustomerGroupDto.from(saved, custIds);
    }

    @Transactional
    public void deleteGroup(Long id) {
        SecurityUtils.enforceNoDelete("CustomerGroup", id);
    }
}
