package com.nbh.erp.customertarget.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customergroup.entity.CustomerGroup;
import com.nbh.erp.customergroup.repository.CustomerGroupRepository;
import com.nbh.erp.customertarget.dto.*;
import com.nbh.erp.customertarget.entity.CustomerTarget;
import com.nbh.erp.customertarget.entity.CustomerTargetTier;
import com.nbh.erp.customertarget.repository.CustomerTargetRepository;
import com.nbh.erp.customertarget.repository.CustomerTargetTierRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerTargetService {

    private final CustomerTargetRepository targetRepository;
    private final CustomerTargetTierRepository tierRepository;
    private final CustomerRepository customerRepository;
    private final CustomerGroupRepository customerGroupRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<CustomerTargetDto> getAllTargets(Boolean activeOnly) {
        List<CustomerTarget> targets = targetRepository.findAllWithTiers();
        if (Boolean.TRUE.equals(activeOnly)) {
            targets = targets.stream().filter(CustomerTarget::getIsActive).collect(Collectors.toList());
        }

        return targets.stream()
                .map(t -> mapToDtoWithProgress(t, t.getCustomer() != null ? t.getCustomer().getId() : null))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CustomerTargetDto getTargetById(Long id) {
        CustomerTarget target = targetRepository.findByIdWithTiers(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerTarget", "id", id));
        return mapToDtoWithProgress(target, target.getCustomer() != null ? target.getCustomer().getId() : null);
    }

    @Transactional(readOnly = true)
    public List<CustomerTargetProgressDto> getCustomerTargetProgress(Long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", customerId));

        LocalDate today = LocalDate.now();
        List<Long> groupIds = customer.getCustomerGroups() != null
                ? customer.getCustomerGroups().stream().map(CustomerGroup::getId).collect(Collectors.toList())
                : Collections.emptyList();

        List<CustomerTarget> activeTargets;
        if (!groupIds.isEmpty()) {
            activeTargets = targetRepository.findActiveTargetsForCustomer(customerId, groupIds, today);
        } else {
            activeTargets = targetRepository.findActiveTargetsForCustomerWithoutGroups(customerId, today);
        }

        return activeTargets.stream()
                .map(t -> mapToProgressDto(t, customerId, customer.getName()))
                .sorted(Comparator.comparing(CustomerTargetProgressDto::getCurrentDiscountPercentage, Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    @Transactional
    public CustomerTargetDto createTarget(CreateCustomerTargetRequest request) {
        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Target");

        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new BusinessException("Start date cannot be after end date");
        }

        String targetCode = request.getTargetCode();
        if (targetCode == null || targetCode.isBlank()) {
            targetCode = sequenceService.generateTargetNumber();
        } else {
            if (targetRepository.findByTargetCode(targetCode).isPresent()) {
                throw new BusinessException("Target code already exists: " + targetCode);
            }
        }

        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", request.getCustomerId()));
        }

        CustomerGroup customerGroup = null;
        if (request.getCustomerGroupId() != null) {
            customerGroup = customerGroupRepository.findById(request.getCustomerGroupId())
                    .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", request.getCustomerGroupId()));
        }

        User salesman = null;
        if (request.getSalesmanId() != null) {
            salesman = userRepository.findById(request.getSalesmanId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getSalesmanId()));
        }

        CustomerTarget target = CustomerTarget.builder()
                .targetCode(targetCode)
                .name(request.getName().trim())
                .description(request.getDescription())
                .customer(customer)
                .customerGroup(customerGroup)
                .salesman(salesman)
                .targetType(request.getTargetType() != null ? request.getTargetType() : "TOTAL_SALES")
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .targetAmount(request.getTargetAmount() != null ? request.getTargetAmount() : BigDecimal.ZERO)
                .rewardType(request.getRewardType() != null ? request.getRewardType() : "PERCENTAGE_DISCOUNT")
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .tiers(new ArrayList<>())
                .build();

        if (request.getTiers() != null && !request.getTiers().isEmpty()) {
            int level = 1;
            for (CreateCustomerTargetRequest.TierRequest tr : request.getTiers()) {
                CustomerTargetTier tier = CustomerTargetTier.builder()
                        .tierLevel(tr.getTierLevel() != null ? tr.getTierLevel() : level++)
                        .tierName(tr.getTierName() != null && !tr.getTierName().isBlank() ? tr.getTierName() : "Tier " + level)
                        .minAmount(tr.getMinAmount() != null ? tr.getMinAmount() : BigDecimal.ZERO)
                        .maxAmount(tr.getMaxAmount())
                        .discountPercentage(tr.getDiscountPercentage() != null ? tr.getDiscountPercentage() : BigDecimal.ZERO)
                        .discountAmount(tr.getDiscountAmount() != null ? tr.getDiscountAmount() : BigDecimal.ZERO)
                        .rewardDescription(tr.getRewardDescription())
                        .build();
                target.addTier(tier);
            }
        }

        CustomerTarget saved = targetRepository.save(target);

        auditLogService.log(
                "CREATE",
                "CUSTOMER",
                saved.getId().toString(),
                "Customer Target: " + saved.getName(),
                "Created customer target " + saved.getTargetCode() + " with " + saved.getTiers().size() + " tiers"
        );

        return mapToDtoWithProgress(saved, customer != null ? customer.getId() : null);
    }

    @Transactional
    public CustomerTargetDto updateTarget(Long id, CreateCustomerTargetRequest request) {
        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Target");

        CustomerTarget target = targetRepository.findByIdWithTiers(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerTarget", "id", id));

        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new BusinessException("Start date cannot be after end date");
        }

        target.setName(request.getName().trim());
        target.setDescription(request.getDescription());
        target.setStartDate(request.getStartDate());
        target.setEndDate(request.getEndDate());
        target.setTargetAmount(request.getTargetAmount() != null ? request.getTargetAmount() : BigDecimal.ZERO);
        target.setTargetType(request.getTargetType() != null ? request.getTargetType() : target.getTargetType());
        target.setRewardType(request.getRewardType() != null ? request.getRewardType() : target.getRewardType());

        if (request.getIsActive() != null) {
            target.setIsActive(request.getIsActive());
        }

        if (request.getCustomerId() != null) {
            Customer customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", request.getCustomerId()));
            target.setCustomer(customer);
        } else {
            target.setCustomer(null);
        }

        if (request.getCustomerGroupId() != null) {
            CustomerGroup group = customerGroupRepository.findById(request.getCustomerGroupId())
                    .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", request.getCustomerGroupId()));
            target.setCustomerGroup(group);
        } else {
            target.setCustomerGroup(null);
        }

        if (request.getSalesmanId() != null) {
            User salesman = userRepository.findById(request.getSalesmanId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getSalesmanId()));
            target.setSalesman(salesman);
        } else {
            target.setSalesman(null);
        }

        // Update tiers: clear and re-add
        target.getTiers().clear();
        if (request.getTiers() != null) {
            int level = 1;
            for (CreateCustomerTargetRequest.TierRequest tr : request.getTiers()) {
                CustomerTargetTier tier = CustomerTargetTier.builder()
                        .tierLevel(tr.getTierLevel() != null ? tr.getTierLevel() : level++)
                        .tierName(tr.getTierName() != null && !tr.getTierName().isBlank() ? tr.getTierName() : "Tier " + level)
                        .minAmount(tr.getMinAmount() != null ? tr.getMinAmount() : BigDecimal.ZERO)
                        .maxAmount(tr.getMaxAmount())
                        .discountPercentage(tr.getDiscountPercentage() != null ? tr.getDiscountPercentage() : BigDecimal.ZERO)
                        .discountAmount(tr.getDiscountAmount() != null ? tr.getDiscountAmount() : BigDecimal.ZERO)
                        .rewardDescription(tr.getRewardDescription())
                        .build();
                target.addTier(tier);
            }
        }

        CustomerTarget saved = targetRepository.save(target);

        auditLogService.log(
                "UPDATE",
                "CUSTOMER",
                saved.getId().toString(),
                "Customer Target: " + saved.getName(),
                "Updated customer target " + saved.getTargetCode()
        );

        return mapToDtoWithProgress(saved, saved.getCustomer() != null ? saved.getCustomer().getId() : null);
    }

    @Transactional
    public void toggleActive(Long id) {
        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Target");
        CustomerTarget target = targetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerTarget", "id", id));
        target.setIsActive(!Boolean.TRUE.equals(target.getIsActive()));
        targetRepository.save(target);

        auditLogService.log(
                "UPDATE",
                "CUSTOMER",
                target.getId().toString(),
                "Customer Target: " + target.getName(),
                "Toggled active status to " + target.getIsActive()
        );
    }

    @Transactional
    public void deleteTarget(Long id) {
        SecurityUtils.enforceCanEdit("CUSTOMER", "Customer Target");
        CustomerTarget target = targetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerTarget", "id", id));
        // Soft deactivate to maintain audit compliance
        target.setIsActive(false);
        targetRepository.save(target);

        auditLogService.log(
                "DEACTIVATE",
                "CUSTOMER",
                target.getId().toString(),
                "Customer Target: " + target.getName(),
                "Deactivated customer target " + target.getTargetCode()
        );
    }

    private BigDecimal calculateAchievedSales(CustomerTarget target, Long customerId) {
        if (customerId != null) {
            return invoiceRepository.getCustomerSalesBetween(customerId, target.getStartDate(), target.getEndDate());
        }
        if (target.getCustomer() != null) {
            return invoiceRepository.getCustomerSalesBetween(target.getCustomer().getId(), target.getStartDate(), target.getEndDate());
        }
        if (target.getSalesman() != null) {
            return invoiceRepository.getSalesmanSalesBetween(target.getSalesman().getId(), target.getStartDate(), target.getEndDate());
        }
        return invoiceRepository.getTotalSalesBetween(target.getStartDate(), target.getEndDate());
    }

    private long calculateInvoiceCount(CustomerTarget target, Long customerId) {
        Long cId = customerId != null ? customerId : (target.getCustomer() != null ? target.getCustomer().getId() : null);
        if (cId != null) {
            return invoiceRepository.countCustomerInvoicesBetween(cId, target.getStartDate(), target.getEndDate());
        }
        return 0L;
    }

    private CustomerTargetDto mapToDtoWithProgress(CustomerTarget target, Long evalCustomerId) {
        BigDecimal achieved = calculateAchievedSales(target, evalCustomerId);
        long invCount = calculateInvoiceCount(target, evalCustomerId);

        BigDecimal goal = target.getTargetAmount();
        BigDecimal percentage = BigDecimal.ZERO;
        if (goal != null && goal.compareTo(BigDecimal.ZERO) > 0) {
            percentage = achieved.multiply(BigDecimal.valueOf(100)).divide(goal, 1, RoundingMode.HALF_UP);
        }

        // Evaluate tiers
        List<CustomerTargetTierDto> tierDtos = new ArrayList<>();
        CustomerTargetTier highestAchievedTier = null;
        CustomerTargetTier nextMilestoneTier = null;

        List<CustomerTargetTier> sortedTiers = target.getTiers().stream()
                .sorted(Comparator.comparing(CustomerTargetTier::getTierLevel))
                .collect(Collectors.toList());

        for (CustomerTargetTier tier : sortedTiers) {
            boolean isAchieved = achieved.compareTo(tier.getMinAmount()) >= 0;
            if (isAchieved) {
                highestAchievedTier = tier;
            } else if (nextMilestoneTier == null) {
                nextMilestoneTier = tier;
            }

            tierDtos.add(CustomerTargetTierDto.builder()
                    .id(tier.getId())
                    .tierLevel(tier.getTierLevel())
                    .tierName(tier.getTierName())
                    .minAmount(tier.getMinAmount())
                    .maxAmount(tier.getMaxAmount())
                    .discountPercentage(tier.getDiscountPercentage())
                    .discountAmount(tier.getDiscountAmount())
                    .rewardDescription(tier.getRewardDescription())
                    .isAchieved(isAchieved)
                    .build());
        }

        BigDecimal neededForNext = BigDecimal.ZERO;
        if (nextMilestoneTier != null) {
            neededForNext = nextMilestoneTier.getMinAmount().subtract(achieved);
            if (neededForNext.compareTo(BigDecimal.ZERO) < 0) {
                neededForNext = BigDecimal.ZERO;
            }
        }

        LocalDate today = LocalDate.now();
        long daysRemaining = 0;
        if (target.getEndDate() != null && !today.isAfter(target.getEndDate())) {
            daysRemaining = ChronoUnit.DAYS.between(today, target.getEndDate());
        }

        return CustomerTargetDto.builder()
                .id(target.getId())
                .targetCode(target.getTargetCode())
                .name(target.getName())
                .description(target.getDescription())
                .customerId(target.getCustomer() != null ? target.getCustomer().getId() : null)
                .customerCode(target.getCustomer() != null ? target.getCustomer().getCustomerCode() : null)
                .customerName(target.getCustomer() != null ? target.getCustomer().getName() : null)
                .customerGroupId(target.getCustomerGroup() != null ? target.getCustomerGroup().getId() : null)
                .customerGroupName(target.getCustomerGroup() != null ? target.getCustomerGroup().getGroupName() : null)
                .salesmanId(target.getSalesman() != null ? target.getSalesman().getId() : null)
                .salesmanName(target.getSalesman() != null ? target.getSalesman().getFullName() : null)
                .salesmanCode(target.getSalesman() != null ? target.getSalesman().getEmployeeCode() : null)
                .targetType(target.getTargetType())
                .startDate(target.getStartDate())
                .endDate(target.getEndDate())
                .targetAmount(target.getTargetAmount())
                .rewardType(target.getRewardType())
                .isActive(target.getIsActive())
                .createdAt(target.getCreatedAt())
                .updatedAt(target.getUpdatedAt())
                .createdBy(target.getCreatedBy())
                .tiers(tierDtos)
                .currentAchievedAmount(achieved)
                .achievementPercentage(percentage)
                .currentAchievedTier(highestAchievedTier != null ? mapTierToDto(highestAchievedTier, true) : null)
                .currentDiscountPercentage(highestAchievedTier != null ? highestAchievedTier.getDiscountPercentage() : BigDecimal.ZERO)
                .currentDiscountAmount(highestAchievedTier != null ? highestAchievedTier.getDiscountAmount() : BigDecimal.ZERO)
                .nextTier(nextMilestoneTier != null ? mapTierToDto(nextMilestoneTier, false) : null)
                .amountNeededForNextTier(neededForNext)
                .invoiceCount(invCount)
                .isTargetAchieved(goal != null && achieved.compareTo(goal) >= 0)
                .daysRemaining(daysRemaining)
                .build();
    }

    private CustomerTargetProgressDto mapToProgressDto(CustomerTarget target, Long customerId, String customerName) {
        BigDecimal achieved = invoiceRepository.getCustomerSalesBetween(customerId, target.getStartDate(), target.getEndDate());
        long count = invoiceRepository.countCustomerInvoicesBetween(customerId, target.getStartDate(), target.getEndDate());

        BigDecimal goal = target.getTargetAmount();
        BigDecimal percentage = BigDecimal.ZERO;
        if (goal != null && goal.compareTo(BigDecimal.ZERO) > 0) {
            percentage = achieved.multiply(BigDecimal.valueOf(100)).divide(goal, 1, RoundingMode.HALF_UP);
        }

        List<CustomerTargetTierDto> tierDtos = new ArrayList<>();
        CustomerTargetTier highestAchievedTier = null;
        CustomerTargetTier nextMilestoneTier = null;

        List<CustomerTargetTier> sortedTiers = target.getTiers().stream()
                .sorted(Comparator.comparing(CustomerTargetTier::getTierLevel))
                .collect(Collectors.toList());

        for (CustomerTargetTier tier : sortedTiers) {
            boolean isAchieved = achieved.compareTo(tier.getMinAmount()) >= 0;
            if (isAchieved) {
                highestAchievedTier = tier;
            } else if (nextMilestoneTier == null) {
                nextMilestoneTier = tier;
            }

            tierDtos.add(CustomerTargetTierDto.builder()
                    .id(tier.getId())
                    .tierLevel(tier.getTierLevel())
                    .tierName(tier.getTierName())
                    .minAmount(tier.getMinAmount())
                    .maxAmount(tier.getMaxAmount())
                    .discountPercentage(tier.getDiscountPercentage())
                    .discountAmount(tier.getDiscountAmount())
                    .rewardDescription(tier.getRewardDescription())
                    .isAchieved(isAchieved)
                    .build());
        }

        BigDecimal neededForNext = BigDecimal.ZERO;
        if (nextMilestoneTier != null) {
            neededForNext = nextMilestoneTier.getMinAmount().subtract(achieved);
            if (neededForNext.compareTo(BigDecimal.ZERO) < 0) {
                neededForNext = BigDecimal.ZERO;
            }
        }

        LocalDate today = LocalDate.now();
        long daysRemaining = 0;
        if (target.getEndDate() != null && !today.isAfter(target.getEndDate())) {
            daysRemaining = ChronoUnit.DAYS.between(today, target.getEndDate());
        }

        return CustomerTargetProgressDto.builder()
                .targetId(target.getId())
                .targetCode(target.getTargetCode())
                .targetName(target.getName())
                .customerId(customerId)
                .customerName(customerName)
                .startDate(target.getStartDate())
                .endDate(target.getEndDate())
                .daysRemaining(daysRemaining)
                .targetAmount(target.getTargetAmount())
                .currentAchievedAmount(achieved)
                .achievementPercentage(percentage)
                .completedInvoicesCount(count)
                .isGoalAchieved(goal != null && achieved.compareTo(goal) >= 0)
                .currentTier(highestAchievedTier != null ? mapTierToDto(highestAchievedTier, true) : null)
                .currentDiscountPercentage(highestAchievedTier != null ? highestAchievedTier.getDiscountPercentage() : BigDecimal.ZERO)
                .currentDiscountAmount(highestAchievedTier != null ? highestAchievedTier.getDiscountAmount() : BigDecimal.ZERO)
                .currentRewardDescription(highestAchievedTier != null ? highestAchievedTier.getRewardDescription() : null)
                .nextTier(nextMilestoneTier != null ? mapTierToDto(nextMilestoneTier, false) : null)
                .amountNeededForNextTier(neededForNext)
                .tiers(tierDtos)
                .build();
    }

    private CustomerTargetTierDto mapTierToDto(CustomerTargetTier tier, boolean isAchieved) {
        return CustomerTargetTierDto.builder()
                .id(tier.getId())
                .tierLevel(tier.getTierLevel())
                .tierName(tier.getTierName())
                .minAmount(tier.getMinAmount())
                .maxAmount(tier.getMaxAmount())
                .discountPercentage(tier.getDiscountPercentage())
                .discountAmount(tier.getDiscountAmount())
                .rewardDescription(tier.getRewardDescription())
                .isAchieved(isAchieved)
                .build();
    }
}
