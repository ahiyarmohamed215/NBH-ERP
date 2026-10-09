package com.nbh.erp.customerrange.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customerrange.dto.*;
import com.nbh.erp.customerrange.entity.CustomerMonthlySummary;
import com.nbh.erp.customerrange.entity.CustomerRangeAuditLog;
import com.nbh.erp.customerrange.entity.CustomerRangeConfig;
import com.nbh.erp.customerrange.repository.CustomerMonthlySummaryRepository;
import com.nbh.erp.customerrange.repository.CustomerRangeAuditLogRepository;
import com.nbh.erp.customerrange.repository.CustomerRangeConfigRepository;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.salesreturn.entity.SalesReturn;
import com.nbh.erp.salesreturn.repository.SalesReturnRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerRangeService {

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Colombo");

    private final CustomerRangeConfigRepository rangeConfigRepository;
    private final CustomerMonthlySummaryRepository summaryRepository;
    private final CustomerRangeAuditLogRepository auditLogRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final SalesReturnRepository salesReturnRepository;
    private final UserRepository userRepository;

    // =========================================================================
    // 1. Range Configuration CRUD & Audit Log
    // =========================================================================

    @Transactional(readOnly = true)
    public List<CustomerRangeConfigDto> getAllRanges() {
        String currentMonth = getCurrentYearMonth();
        List<CustomerRangeConfig> configs = rangeConfigRepository.findAllByOrderByDisplayOrderAscMinSpendAsc();

        return configs.stream().map(c -> {
            long count = summaryRepository.countByYearMonthAndCurrentRangeId(currentMonth, c.getId());
            return CustomerRangeConfigDto.from(c, count);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerRangeConfig> getActiveRanges() {
        List<CustomerRangeConfig> list = rangeConfigRepository.findByIsActiveTrueOrderByMinSpendAsc();
        if (list.isEmpty()) {
            ensureDefaultRanges();
            return rangeConfigRepository.findByIsActiveTrueOrderByMinSpendAsc();
        }
        return list;
    }

    @Transactional
    public CustomerRangeConfigDto createRange(CreateCustomerRangeConfigRequest request) {
        if (request.getMinSpend() == null || request.getMinSpend().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Monthly purchase threshold must be non-negative");
        }

        if (rangeConfigRepository.existsByMinSpend(request.getMinSpend())) {
            throw new BusinessException("A range with monthly threshold Rs. " + request.getMinSpend() + " already exists");
        }

        String rangeCode = request.getRangeCode();
        if (rangeCode == null || rangeCode.trim().isEmpty()) {
            long count = rangeConfigRepository.count();
            rangeCode = "RANGE_" + (count);
        } else {
            rangeCode = rangeCode.trim().toUpperCase();
            if (rangeConfigRepository.existsByRangeCode(rangeCode)) {
                throw new BusinessException("Range code '" + rangeCode + "' already exists");
            }
        }

        int displayOrder = request.getDisplayOrder() != null ? request.getDisplayOrder() : (int) rangeConfigRepository.count();

        CustomerRangeConfig entity = CustomerRangeConfig.builder()
                .rangeCode(rangeCode)
                .name(request.getName().trim())
                .minSpend(request.getMinSpend().setScale(2, RoundingMode.HALF_UP))
                .displayOrder(displayOrder)
                .isActive(request.getIsActive() == null || request.getIsActive())
                .description(request.getDescription())
                .build();

        CustomerRangeConfig saved = rangeConfigRepository.save(entity);

        recordAuditLog("CREATE_RANGE", saved.getId(),
                String.format("Created range '%s' (%s) with monthly threshold Rs. %s",
                        saved.getName(), saved.getRangeCode(), saved.getMinSpend()));

        log.info("Customer range created: {} ({}) threshold {}", saved.getName(), saved.getRangeCode(), saved.getMinSpend());
        return CustomerRangeConfigDto.from(saved, 0);
    }

    @Transactional
    public CustomerRangeConfigDto updateRange(Long id, UpdateCustomerRangeConfigRequest request) {
        CustomerRangeConfig config = rangeConfigRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerRangeConfig", "id", id));

        if ("RANGE_0".equalsIgnoreCase(config.getRangeCode()) || config.getDisplayOrder() == 0) {
            if (request.getMinSpend().compareTo(BigDecimal.ZERO) != 0) {
                throw new BusinessException("Baseline Range 0 must always start at Rs. 0.00");
            }
        }

        if (request.getMinSpend().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Monthly purchase threshold must be non-negative");
        }

        if (rangeConfigRepository.existsByMinSpendAndIdNot(request.getMinSpend(), id)) {
            throw new BusinessException("Another range with monthly threshold Rs. " + request.getMinSpend() + " already exists");
        }

        String oldDetails = String.format("Name: %s, Threshold: %s, Active: %s",
                config.getName(), config.getMinSpend(), config.getIsActive());

        config.setName(request.getName().trim());
        config.setMinSpend(request.getMinSpend().setScale(2, RoundingMode.HALF_UP));
        if (request.getDisplayOrder() != null) config.setDisplayOrder(request.getDisplayOrder());
        if (request.getIsActive() != null) config.setIsActive(request.getIsActive());
        if (request.getDescription() != null) config.setDescription(request.getDescription());

        CustomerRangeConfig saved = rangeConfigRepository.save(config);

        recordAuditLog("UPDATE_RANGE", saved.getId(),
                String.format("Updated range '%s'. Was [%s], now [Name: %s, Threshold: %s, Active: %s]",
                        saved.getName(), oldDetails, saved.getName(), saved.getMinSpend(), saved.getIsActive()));

        long customerCount = summaryRepository.countByYearMonthAndCurrentRangeId(getCurrentYearMonth(), saved.getId());
        return CustomerRangeConfigDto.from(saved, customerCount);
    }

    @Transactional
    public CustomerRangeConfigDto toggleRangeStatus(Long id, boolean active) {
        CustomerRangeConfig config = rangeConfigRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerRangeConfig", "id", id));

        if ("RANGE_0".equalsIgnoreCase(config.getRangeCode()) && !active) {
            throw new BusinessException("Baseline Range 0 cannot be deactivated");
        }

        config.setIsActive(active);
        CustomerRangeConfig saved = rangeConfigRepository.save(config);

        recordAuditLog("STATUS_CHANGE", saved.getId(),
                String.format("Range '%s' (%s) set to active=%s", saved.getName(), saved.getRangeCode(), active));

        long count = summaryRepository.countByYearMonthAndCurrentRangeId(getCurrentYearMonth(), saved.getId());
        return CustomerRangeConfigDto.from(saved, count);
    }

    @Transactional(readOnly = true)
    public List<RangeAuditLogDto> getAuditLogs() {
        return auditLogRepository.findTop50ByOrderByPerformedAtDesc()
                .stream().map(RangeAuditLogDto::from).toList();
    }

    // =========================================================================
    // 2. Customer Monthly Calculations & Progress Inquiries
    // =========================================================================

    @Transactional
    public CustomerMonthlyProgressDto getCustomerProgress(Long customerId, BigDecimal hypotheticalCartTotal) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", customerId));

        String currentMonth = getCurrentYearMonth();
        CustomerMonthlySummary summary = getOrRecalculateSummary(customer, currentMonth);

        List<CustomerRangeConfig> activeRanges = getActiveRanges();
        CustomerRangeConfig currentRange = summary.getCurrentRange();

        // Identify next target range
        CustomerRangeConfig nextRange = findNextRange(activeRanges, currentRange);

        BigDecimal qualifying = summary.getQualifyingPurchases();
        BigDecimal remaining = BigDecimal.ZERO;
        BigDecimal progressPct = BigDecimal.valueOf(100);
        boolean isHighest = (nextRange == null);

        if (nextRange != null) {
            remaining = nextRange.getMinSpend().subtract(qualifying).max(BigDecimal.ZERO);
            if (nextRange.getMinSpend().compareTo(BigDecimal.ZERO) > 0) {
                progressPct = qualifying.divide(nextRange.getMinSpend(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
                if (progressPct.compareTo(BigDecimal.valueOf(100)) > 0) {
                    progressPct = BigDecimal.valueOf(100);
                }
            }
        }

        User staff = customer.getEffectiveAssignedStaff();

        CustomerMonthlyProgressDto.CustomerMonthlyProgressDtoBuilder builder = CustomerMonthlyProgressDto.builder()
                .customerId(customer.getId())
                .customerCode(customer.getCustomerCode())
                .customerName(customer.getName())
                .customerPhone(customer.getPhone())
                .assignedStaffId(staff != null ? staff.getId() : null)
                .assignedStaffName(staff != null ? (staff.getFullName() != null ? staff.getFullName() : staff.getUsername()) : "Unassigned")
                .assignedStaffUsername(staff != null ? staff.getUsername() : null)
                .yearMonth(currentMonth)
                .monthLabel(formatMonthLabel(currentMonth))
                .monthlyPurchases(qualifying)
                .invoiceCount(summary.getInvoiceCount())
                .lastPurchaseDate(summary.getLastPurchaseDate())
                .currentRangeId(currentRange.getId())
                .currentRangeCode(currentRange.getRangeCode())
                .currentRangeName(currentRange.getName())
                .currentRangeThreshold(currentRange.getMinSpend())
                .nextRangeId(nextRange != null ? nextRange.getId() : null)
                .nextRangeCode(nextRange != null ? nextRange.getRangeCode() : null)
                .nextRangeName(nextRange != null ? nextRange.getName() : "Highest Tier Achieved")
                .nextRangeThreshold(nextRange != null ? nextRange.getMinSpend() : currentRange.getMinSpend())
                .remainingAmount(remaining)
                .progressPercentage(progressPct)
                .isHighestRange(isHighest);

        // Calculate hypothetical cart projection if bill amount is provided
        if (hypotheticalCartTotal != null && hypotheticalCartTotal.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal cartAmt = hypotheticalCartTotal.setScale(2, RoundingMode.HALF_UP);
            BigDecimal projectedPurchases = qualifying.add(cartAmt);
            CustomerRangeConfig projectedRange = determineRangeForAmount(activeRanges, projectedPurchases);
            CustomerRangeConfig projectedNext = findNextRange(activeRanges, projectedRange);

            BigDecimal projRemaining = BigDecimal.ZERO;
            BigDecimal projProgressPct = BigDecimal.valueOf(100);
            boolean projIsHighest = (projectedNext == null);

            if (projectedNext != null) {
                projRemaining = projectedNext.getMinSpend().subtract(projectedPurchases).max(BigDecimal.ZERO);
                if (projectedNext.getMinSpend().compareTo(BigDecimal.ZERO) > 0) {
                    projProgressPct = projectedPurchases.divide(projectedNext.getMinSpend(), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
                    if (projProgressPct.compareTo(BigDecimal.valueOf(100)) > 0) {
                        projProgressPct = BigDecimal.valueOf(100);
                    }
                }
            }

            boolean achievedNew = projectedRange.getMinSpend().compareTo(currentRange.getMinSpend()) > 0;
            String msg = null;
            if (achievedNew) {
                if (projIsHighest) {
                    msg = String.format("🎉 Congratulations! %s will achieve the highest customer tier (%s) with this bill!",
                            customer.getName(), projectedRange.getName());
                } else {
                    msg = String.format("🎉 Congratulations! %s will reach %s with this bill!",
                            customer.getName(), projectedRange.getName());
                }
            }

            builder.currentBillAmount(cartAmt)
                    .projectedMonthlyPurchases(projectedPurchases)
                    .projectedRangeId(projectedRange.getId())
                    .projectedRangeCode(projectedRange.getRangeCode())
                    .projectedRangeName(projectedRange.getName())
                    .projectedNextRangeId(projectedNext != null ? projectedNext.getId() : null)
                    .projectedNextRangeName(projectedNext != null ? projectedNext.getName() : "Highest Tier Achieved")
                    .projectedNextTarget(projectedNext != null ? projectedNext.getMinSpend() : projectedRange.getMinSpend())
                    .projectedRemainingAmount(projRemaining)
                    .projectedProgressPercentage(projProgressPct)
                    .willAchieveNewRange(achievedNew)
                    .isProjectedHighestRange(projIsHighest)
                    .achievementNotificationMessage(msg);
        }

        return builder.build();
    }

    // =========================================================================
    // 3. Automated Lifecycle Synchronization (Invoices & Returns)
    // =========================================================================

    @Transactional
    public void onInvoiceFinalized(Invoice invoice) {
        if (invoice == null || invoice.getCustomer() == null) return;
        LocalDate invDate = invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now(BUSINESS_ZONE);
        String yearMonth = YearMonth.from(invDate).toString();

        Customer customer = invoice.getCustomer();
        CustomerMonthlySummary summary = recalculateSummary(customer, yearMonth, invoice);

        log.info("Synchronized customer monthly summary for customer {} ({}) for month {}: Total Rs. {}, Range {}",
                customer.getName(), customer.getCustomerCode(), yearMonth, summary.getQualifyingPurchases(), summary.getCurrentRange().getName());
    }

    @Transactional
    public void onInvoiceVoided(Invoice invoice) {
        if (invoice == null || invoice.getCustomer() == null) return;
        LocalDate invDate = invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now(BUSINESS_ZONE);
        String yearMonth = YearMonth.from(invDate).toString();

        recalculateSummary(invoice.getCustomer(), yearMonth, null);
    }

    @Transactional
    public void onSalesReturnCompleted(SalesReturn salesReturn) {
        if (salesReturn == null || salesReturn.getCustomer() == null) return;
        LocalDate retDate = salesReturn.getReturnDate() != null ? salesReturn.getReturnDate() : LocalDate.now(BUSINESS_ZONE);
        String yearMonth = YearMonth.from(retDate).toString();

        recalculateSummary(salesReturn.getCustomer(), yearMonth, null);
    }

    // =========================================================================
    // 4. Staff Dashboard: "My Customer Targets"
    // =========================================================================

    @Transactional(readOnly = true)
    public Page<StaffCustomerTargetDto> getMyCustomerTargets(String search, Long rangeId, String sort, Pageable pageable) {
        Long currentUserId = SecurityUtils.getCurrentUserId()
                .orElseThrow(() -> new BusinessException("User must be authenticated"));

        String currentMonth = getCurrentYearMonth();
        List<CustomerRangeConfig> activeRanges = getActiveRanges();

        // Find summaries for staff member
        Page<CustomerMonthlySummary> page = summaryRepository.findByStaffAndMonth(
                currentUserId, currentMonth, rangeId, search, pageable);

        return page.map(summary -> mapToStaffCustomerTargetDto(summary, activeRanges));
    }

    @Transactional(readOnly = true)
    public List<StaffCustomerTargetDto> getMyCustomersNearTarget() {
        Long currentUserId = SecurityUtils.getCurrentUserId()
                .orElseThrow(() -> new BusinessException("User must be authenticated"));

        String currentMonth = getCurrentYearMonth();
        List<CustomerRangeConfig> activeRanges = getActiveRanges();

        Page<CustomerMonthlySummary> page = summaryRepository.findByStaffAndMonth(
                currentUserId, currentMonth, null, null, PageRequest.of(0, 100));

        return page.getContent().stream()
                .map(s -> mapToStaffCustomerTargetDto(s, activeRanges))
                .filter(dto -> Boolean.TRUE.equals(dto.getIsCloseToTarget()) && !Boolean.TRUE.equals(dto.getIsHighestRange()))
                .sorted(Comparator.comparing(StaffCustomerTargetDto::getRemainingAmount))
                .limit(10)
                .toList();
    }

    // =========================================================================
    // 5. Manager Dashboard & Staff Performance
    // =========================================================================

    @Transactional(readOnly = true)
    public ManagerRangeDashboardDto getManagerDashboard(String yearMonth, Long staffId, Long rangeId, String search, Pageable pageable) {
        String targetMonth = (yearMonth != null && !yearMonth.isBlank()) ? yearMonth.trim() : getCurrentYearMonth();
        List<CustomerRangeConfig> activeRanges = getActiveRanges();

        long totalActiveCustomers = customerRepository.count();
        long activePurchasers = summaryRepository.countActivePurchasersByYearMonth(targetMonth);
        long zeroPurchasers = Math.max(0, totalActiveCustomers - activePurchasers);
        BigDecimal totalSales = summaryRepository.getTotalQualifyingSalesByYearMonth(targetMonth);

        // Range customer counts breakdown
        Map<String, Long> rangeCounts = new LinkedHashMap<>();
        long promotedCount = 0;
        for (CustomerRangeConfig r : activeRanges) {
            long count = summaryRepository.countByYearMonthAndCurrentRangeId(targetMonth, r.getId());
            rangeCounts.put(r.getName(), count);
            if (r.getMinSpend().compareTo(BigDecimal.ZERO) > 0) {
                promotedCount += count;
            }
        }

        Page<CustomerMonthlySummary> summariesPage = summaryRepository.searchMonthlySummaries(
                targetMonth, rangeId, staffId, search, pageable);

        List<StaffCustomerTargetDto> customerDtos = summariesPage.getContent().stream()
                .map(s -> mapToStaffCustomerTargetDto(s, activeRanges))
                .toList();

        long nearTargetCount = customerDtos.stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsCloseToTarget()) && !Boolean.TRUE.equals(c.getIsHighestRange()))
                .count();

        List<CustomerRangeConfigDto> rangeConfigDtos = activeRanges.stream()
                .map(r -> CustomerRangeConfigDto.from(r, rangeCounts.getOrDefault(r.getName(), 0L)))
                .toList();

        return ManagerRangeDashboardDto.builder()
                .yearMonth(targetMonth)
                .monthLabel(formatMonthLabel(targetMonth))
                .totalActiveCustomers(totalActiveCustomers)
                .customersWithPurchases(activePurchasers)
                .customersWithZeroPurchases(zeroPurchasers)
                .totalMonthlyQualifyingSales(totalSales)
                .promotedCustomersCount(promotedCount)
                .customersCloseToTargetCount(nearTargetCount)
                .rangeCustomerCounts(rangeCounts)
                .configuredRanges(rangeConfigDtos)
                .customers(customerDtos)
                .pageNumber(summariesPage.getNumber())
                .pageSize(summariesPage.getSize())
                .totalElements(summariesPage.getTotalElements())
                .totalPages(summariesPage.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public List<StaffPerformanceDto> getStaffPerformanceReport(String yearMonth) {
        String targetMonth = (yearMonth != null && !yearMonth.isBlank()) ? yearMonth.trim() : getCurrentYearMonth();
        List<CustomerMonthlySummaryRepository.StaffPerformanceProjection> list = summaryRepository.getStaffPerformanceForMonth(targetMonth);

        return list.stream().map(p -> StaffPerformanceDto.builder()
                .staffId(p.getStaffId())
                .staffName(p.getStaffName() != null ? p.getStaffName() : p.getStaffUsername())
                .staffUsername(p.getStaffUsername())
                .totalAssignedCustomers(p.getTotalAssignedCustomers() != null ? p.getTotalAssignedCustomers() : 0)
                .activePurchasingCustomers(p.getActivePurchasingCustomers() != null ? p.getActivePurchasingCustomers() : 0)
                .promotedCustomers(p.getPromotedCustomers() != null ? p.getPromotedCustomers() : 0)
                .totalQualifyingPurchases(p.getTotalQualifyingPurchases() != null ? p.getTotalQualifyingPurchases() : BigDecimal.ZERO)
                .build()).toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerRangeHistoryDto> getCustomerRangeHistory(Long customerId) {
        List<CustomerMonthlySummary> summaries = summaryRepository.findByCustomerIdOrderByYearMonthDesc(customerId);

        return summaries.stream().map(s -> CustomerRangeHistoryDto.builder()
                .yearMonth(s.getYearMonth())
                .monthLabel(formatMonthLabel(s.getYearMonth()))
                .qualifyingPurchases(s.getQualifyingPurchases())
                .finalRangeName(s.getCurrentRange().getName())
                .finalRangeCode(s.getCurrentRange().getRangeCode())
                .finalRangeMinSpend(s.getCurrentRange().getMinSpend())
                .invoiceCount(s.getInvoiceCount())
                .lastPurchaseDate(s.getLastPurchaseDate())
                .build()).toList();
    }

    // =========================================================================
    // 6. Internal Calculation Helpers
    // =========================================================================

    public String getCurrentYearMonth() {
        return YearMonth.now(BUSINESS_ZONE).toString();
    }

    @Transactional
    public CustomerMonthlySummary getOrRecalculateSummary(Customer customer, String yearMonth) {
        return summaryRepository.findByCustomerIdAndYearMonth(customer.getId(), yearMonth)
                .orElseGet(() -> recalculateSummary(customer, yearMonth, null));
    }

    @Transactional
    public CustomerMonthlySummary recalculateSummary(Customer customer, String yearMonth, Invoice latestInv) {
        YearMonth ym = YearMonth.parse(yearMonth);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        // 1. Compute gross sales from qualifying invoices (COMPLETED, PAID, PARTIAL)
        BigDecimal grossSales = invoiceRepository.getCustomerSalesBetween(customer.getId(), start, end);
        if (grossSales == null) grossSales = BigDecimal.ZERO;

        // 2. Subtract completed sales returns / credit notes
        BigDecimal totalReturns = salesReturnRepository.getCustomerReturnsBetween(customer.getId(), start, end);
        if (totalReturns == null) totalReturns = BigDecimal.ZERO;

        BigDecimal qualifying = grossSales.subtract(totalReturns).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        long invCount = invoiceRepository.countCustomerInvoicesBetween(customer.getId(), start, end);

        List<CustomerRangeConfig> activeRanges = getActiveRanges();
        CustomerRangeConfig matchedRange = determineRangeForAmount(activeRanges, qualifying);

        CustomerMonthlySummary summary = summaryRepository.findByCustomerIdAndYearMonth(customer.getId(), yearMonth)
                .orElseGet(() -> CustomerMonthlySummary.builder()
                        .customer(customer)
                        .yearMonth(yearMonth)
                        .currentRange(matchedRange)
                        .highestRangeAchieved(matchedRange)
                        .build());

        CustomerRangeConfig prevRange = summary.getCurrentRange();
        summary.setQualifyingPurchases(qualifying);
        summary.setInvoiceCount((int) invCount);
        summary.setCurrentRange(matchedRange);

        // Update highest range achieved if promoted
        if (summary.getHighestRangeAchieved() == null ||
                matchedRange.getMinSpend().compareTo(summary.getHighestRangeAchieved().getMinSpend()) > 0) {
            summary.setHighestRangeAchieved(matchedRange);
        }

        if (latestInv != null) {
            summary.setLastInvoice(latestInv);
            summary.setLastPurchaseDate(latestInv.getInvoiceDate());
        }

        User staff = customer.getEffectiveAssignedStaff();
        summary.setAssignedStaff(staff);

        CustomerMonthlySummary saved = summaryRepository.save(summary);

        // Check for promotion milestone audit logging
        if (prevRange != null && matchedRange.getMinSpend().compareTo(prevRange.getMinSpend()) > 0) {
            recordAuditLog("RANGE_ACHIEVED", customer.getId(),
                    String.format("Customer '%s' promoted from %s to %s with monthly purchases Rs. %s in %s",
                            customer.getName(), prevRange.getName(), matchedRange.getName(), qualifying, yearMonth));
        }

        return saved;
    }

    public CustomerRangeConfig determineRangeForAmount(List<CustomerRangeConfig> ranges, BigDecimal amount) {
        if (ranges == null || ranges.isEmpty()) {
            ensureDefaultRanges();
            ranges = rangeConfigRepository.findByIsActiveTrueOrderByMinSpendAsc();
        }

        CustomerRangeConfig matched = ranges.get(0);
        for (CustomerRangeConfig r : ranges) {
            if (amount.compareTo(r.getMinSpend()) >= 0) {
                matched = r;
            } else {
                break;
            }
        }
        return matched;
    }

    public CustomerRangeConfig findNextRange(List<CustomerRangeConfig> ranges, CustomerRangeConfig current) {
        if (ranges == null || current == null) return null;
        for (CustomerRangeConfig r : ranges) {
            if (r.getMinSpend().compareTo(current.getMinSpend()) > 0) {
                return r;
            }
        }
        return null; // Already at highest range
    }

    private StaffCustomerTargetDto mapToStaffCustomerTargetDto(CustomerMonthlySummary s, List<CustomerRangeConfig> activeRanges) {
        Customer c = s.getCustomer();
        CustomerRangeConfig curr = s.getCurrentRange();
        CustomerRangeConfig next = findNextRange(activeRanges, curr);

        BigDecimal qualifying = s.getQualifyingPurchases();
        BigDecimal remaining = BigDecimal.ZERO;
        BigDecimal progressPct = BigDecimal.valueOf(100);
        boolean isHighest = (next == null);

        if (next != null) {
            remaining = next.getMinSpend().subtract(qualifying).max(BigDecimal.ZERO);
            if (next.getMinSpend().compareTo(BigDecimal.ZERO) > 0) {
                progressPct = qualifying.divide(next.getMinSpend(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
                if (progressPct.compareTo(BigDecimal.valueOf(100)) > 0) {
                    progressPct = BigDecimal.valueOf(100);
                }
            }
        }

        // Close to target: progress >= 75% or remaining is less than 25% of step
        boolean close = false;
        if (next != null) {
            BigDecimal step = next.getMinSpend().subtract(curr.getMinSpend());
            if (step.compareTo(BigDecimal.ZERO) > 0 && remaining.compareTo(step.multiply(BigDecimal.valueOf(0.25))) <= 0) {
                close = true;
            } else if (progressPct.compareTo(BigDecimal.valueOf(75)) >= 0) {
                close = true;
            }
        }

        User staff = s.getAssignedStaff() != null ? s.getAssignedStaff() : c.getEffectiveAssignedStaff();

        return StaffCustomerTargetDto.builder()
                .customerId(c.getId())
                .customerCode(c.getCustomerCode())
                .customerName(c.getName())
                .customerPhone(c.getPhone())
                .contactPerson(c.getContactPerson())
                .currentRangeId(curr.getId())
                .currentRangeName(curr.getName())
                .currentRangeCode(curr.getRangeCode())
                .monthlyPurchases(qualifying)
                .nextRangeId(next != null ? next.getId() : null)
                .nextRangeName(next != null ? next.getName() : "Highest Tier Achieved")
                .nextTargetAmount(next != null ? next.getMinSpend() : curr.getMinSpend())
                .remainingAmount(remaining)
                .progressPercentage(progressPct)
                .isCloseToTarget(close)
                .isHighestRange(isHighest)
                .lastPurchaseDate(s.getLastPurchaseDate())
                .latestInvoiceNumber(s.getLastInvoice() != null ? s.getLastInvoice().getInvoiceNumber() : null)
                .latestInvoiceAmount(s.getLastInvoice() != null ? s.getLastInvoice().getNetTotal() : null)
                .assignedStaffId(staff != null ? staff.getId() : null)
                .assignedStaffName(staff != null ? (staff.getFullName() != null ? staff.getFullName() : staff.getUsername()) : "Unassigned")
                .build();
    }

    private String formatMonthLabel(String yearMonth) {
        try {
            YearMonth ym = YearMonth.parse(yearMonth);
            return ym.format(DateTimeFormatter.ofPattern("MMMM yyyy"));
        } catch (Exception e) {
            return yearMonth;
        }
    }

    private void recordAuditLog(String actionType, Long targetId, String details) {
        String user = SecurityUtils.getCurrentUsername().orElse("SYSTEM");
        CustomerRangeAuditLog logEntity = CustomerRangeAuditLog.builder()
                .actionType(actionType)
                .targetId(targetId)
                .details(details)
                .performedBy(user)
                .performedAt(LocalDateTime.now(BUSINESS_ZONE))
                .build();
        auditLogRepository.save(logEntity);
    }

    private void ensureDefaultRanges() {
        if (rangeConfigRepository.count() == 0) {
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_0").name("Range 0").minSpend(BigDecimal.ZERO).displayOrder(0).isActive(true).description("Default starting tier").build());
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_1").name("Range 1").minSpend(BigDecimal.valueOf(50000)).displayOrder(1).isActive(true).description("Bronze tier purchasing target").build());
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_2").name("Range 2").minSpend(BigDecimal.valueOf(150000)).displayOrder(2).isActive(true).description("Silver tier purchasing target").build());
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_3").name("Range 3").minSpend(BigDecimal.valueOf(300000)).displayOrder(3).isActive(true).description("Gold tier purchasing target").build());
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_4").name("Range 4").minSpend(BigDecimal.valueOf(500000)).displayOrder(4).isActive(true).description("Platinum tier purchasing target").build());
            rangeConfigRepository.save(CustomerRangeConfig.builder().rangeCode("RANGE_5").name("Range 5").minSpend(BigDecimal.valueOf(1000000)).displayOrder(5).isActive(true).description("Diamond VIP purchasing target").build());
        }
    }
}
