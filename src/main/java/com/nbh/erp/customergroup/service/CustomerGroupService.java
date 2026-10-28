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
    private final com.nbh.erp.customer.service.CustomerAssignmentPolicy assignmentPolicy;

    private User assignedPosStaff(Long staffId){
        if(staffId==null)return null;
        var staff=userRepository.findById(staffId).orElseThrow(()->new ResourceNotFoundException("User","id",staffId));
        if(!com.nbh.erp.customer.service.PosCustomerAccess.canUsePos(staff))throw new com.nbh.erp.common.exception.BusinessException("Assign an active, approved staff member with POS access");
        return staff;
    }

    @Transactional(readOnly = true)
    public List<CustomerGroupDto> getAllGroups() {
        return getAllGroups(true);
    }

    @Transactional(readOnly = true)
    public List<CustomerGroupDto> getAllGroups(boolean includeInactive) {
        List<CustomerGroup> groups = includeInactive
                ? customerGroupRepository.findAll()
                : customerGroupRepository.findByIsActiveTrue();
        return groups.stream()
                .sorted(java.util.Comparator.comparing(
                        (CustomerGroup g) -> g.getUpdatedAt() != null ? g.getUpdatedAt() : g.getCreatedAt(),
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
                ).thenComparing(CustomerGroup::getId, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(group -> {
            List<Long> custIds = customerRepository.findByCustomerGroupId(group.getId()).stream()
                    .filter(c -> includeInactive || Boolean.TRUE.equals(c.getIsActive()))
                    .map(com.nbh.erp.customer.entity.Customer::getId)
                    .toList();
            return CustomerGroupDto.from(group, custIds);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerGroupDto> getActiveGroups() {
        return customerGroupRepository.findByIsActiveTrue().stream()
                .sorted(java.util.Comparator.comparing(
                        (CustomerGroup g) -> g.getUpdatedAt() != null ? g.getUpdatedAt() : g.getCreatedAt(),
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
                ).thenComparing(CustomerGroup::getId, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(group -> {
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

    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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
            assignedStaff = assignedPosStaff(staffId);
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

        var members=assignmentPolicy.lockCustomers(request.getCustomerIds()==null?List.of():request.getCustomerIds());
        members.forEach(CustomerRepository::requireActive);
        assignmentPolicy.validateGroup(null,staffId,members);
        CustomerGroup saved = customerGroupRepository.save(group);

        if (request.getCustomerIds() != null && !request.getCustomerIds().isEmpty()) {
            members.forEach(c -> {
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

    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public CustomerGroupDto updateGroup(Long id, CreateCustomerGroupRequest request) {
        CustomerGroup group = customerGroupRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", id));

        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Group: " + group.getGroupName());

        var previousMembers=customerRepository.findAllGroupMembers(id);
        var memberIds=request.getCustomerIds()==null?previousMembers.stream().map(com.nbh.erp.customer.entity.Customer::getId).toList():request.getCustomerIds();
        var affected=new java.util.HashSet<Long>(memberIds);
        previousMembers.forEach(c->affected.add(c.getId()));
        var lockedMembers=assignmentPolicy.lockCustomers(affected);
        var members=lockedMembers.stream().filter(c->memberIds.contains(c.getId())).toList();
        if(request.getCustomerIds()!=null)members.forEach(CustomerRepository::requireActive);
        assignmentPolicy.validateGroup(id,request.getEffectiveStaffId(),members);

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
            User assignedStaff = assignedPosStaff(staffId);
            group.setAssignedStaff(assignedStaff);
        } else {
            group.setAssignedStaff(null);
        }

        if (request.getIsActive() != null) {
            group.setIsActive(request.getIsActive());
        }

        CustomerGroup saved = customerGroupRepository.save(group);

        if (request.getCustomerIds() != null) {
            previousMembers.forEach(c -> {
                if (!request.getCustomerIds().contains(c.getId())) {
                    var remainingGroups=c.getCustomerGroups();
                    remainingGroups.removeIf(g -> g.getId().equals(saved.getId()));
                    if (c.getCustomerGroup() != null && c.getCustomerGroup().getId().equals(saved.getId())) {
                        c.setCustomerGroup(remainingGroups.isEmpty() ? null : remainingGroups.iterator().next());
                    }
                }
            });
            members.forEach(c -> {
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
