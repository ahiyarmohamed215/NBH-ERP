package com.nbh.erp.inventory.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.inventory.dto.*;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.inventory.repository.ProductStaffQuotaRepository;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductStaffQuotaService {

    private final ProductStaffQuotaRepository quotaRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final StockService stockService;
    private final StockBalanceRepository stockBalanceRepository;

    @Transactional(readOnly = true)
    public Page<ProductStaffQuotaDto> searchQuotas(
            Long productId,
            Long userId,
            Long warehouseId,
            Boolean activeOnly,
            String query,
            Pageable pageable
    ) {
        return quotaRepository.searchQuotas(productId, userId, warehouseId, activeOnly, query, pageable)
                .map(q -> {
                    BigDecimal totalStock = BigDecimal.ZERO;
                    BigDecimal whStock = BigDecimal.ZERO;
                    if (q.getProduct() != null) {
                        Long pId = q.getProduct().getId();
                        BigDecimal tot = stockBalanceRepository.getTotalEnterpriseStockForProduct(pId);
                        totalStock = tot != null ? tot : BigDecimal.ZERO;
                        Long whId = q.getWarehouse() != null ? q.getWarehouse().getId() : (warehouseId != null ? warehouseId : 1L);
                        whStock = stockService.getAvailableStock(whId, pId);
                    }
                    return ProductStaffQuotaDto.fromEntity(q, totalStock, whStock);
                });
    }

    @Transactional(readOnly = true)
    public ProductStaffQuotaDto getQuotaById(Long id) {
        ProductStaffQuota quota = quotaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProductStaffQuota", "id", id));
        BigDecimal totalStock = BigDecimal.ZERO;
        BigDecimal whStock = BigDecimal.ZERO;
        if (quota.getProduct() != null) {
            Long pId = quota.getProduct().getId();
            BigDecimal tot = stockBalanceRepository.getTotalEnterpriseStockForProduct(pId);
            totalStock = tot != null ? tot : BigDecimal.ZERO;
            Long whId = quota.getWarehouse() != null ? quota.getWarehouse().getId() : 1L;
            whStock = stockService.getAvailableStock(whId, pId);
        }
        return ProductStaffQuotaDto.fromEntity(quota, totalStock, whStock);
    }

    @Transactional
    public ProductStaffQuotaDto createOrUpdateQuota(CreateProductStaffQuotaRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        Warehouse warehouse = null;
        if (request.getWarehouseId() != null) {
            warehouse = warehouseRepository.findById(request.getWarehouseId()).orElse(null);
        }
        if (warehouse == null && product.getDefaultWarehouse() != null) {
            warehouse = product.getDefaultWarehouse();
        }

        // Check if an existing quota already exists for this (product, user, warehouse)
        Optional<ProductStaffQuota> existingOpt = (warehouse != null)
                ? quotaRepository.findByProductIdAndUserIdAndWarehouseId(product.getId(), user.getId(), warehouse.getId())
                : quotaRepository.findByProductIdAndUserIdAndWarehouseIsNull(product.getId(), user.getId());

        ProductStaffQuota quota;
        if (existingOpt.isPresent()) {
            quota = existingOpt.get();
            quota.setAllocatedQuantity(request.getAllocatedQuantity());
            quota.setIsActive(true);
            if (request.getValidFrom() != null) quota.setValidFrom(request.getValidFrom());
            if (request.getValidTo() != null) quota.setValidTo(request.getValidTo());
            if (request.getNotes() != null) quota.setNotes(request.getNotes());
            log.info("Updated existing quota ID {} for user {} on product {} to {}",
                    quota.getId(), user.getUsername(), product.getSku(), request.getAllocatedQuantity());
        } else {
            quota = ProductStaffQuota.builder()
                    .product(product)
                    .user(user)
                    .warehouse(warehouse)
                    .allocatedQuantity(request.getAllocatedQuantity())
                    .soldQuantity(BigDecimal.ZERO)
                    .isActive(true)
                    .validFrom(request.getValidFrom())
                    .validTo(request.getValidTo())
                    .notes(request.getNotes())
                    .build();
            log.info("Created new quota for user {} on product {} allocated {}",
                    user.getUsername(), product.getSku(), request.getAllocatedQuantity());
        }

        ProductStaffQuota saved = quotaRepository.save(quota);
        Long whId = saved.getWarehouse() != null ? saved.getWarehouse().getId() : 1L;
        BigDecimal whStock = stockService.getAvailableStock(whId, product.getId());
        BigDecimal tot = stockBalanceRepository.getTotalEnterpriseStockForProduct(product.getId());
        BigDecimal totalStock = tot != null ? tot : BigDecimal.ZERO;
        return ProductStaffQuotaDto.fromEntity(saved, totalStock, whStock);
    }

    @Transactional
    public ProductStaffQuotaDto updateQuota(Long id, UpdateProductStaffQuotaRequest request) {
        ProductStaffQuota quota = quotaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProductStaffQuota", "id", id));

        if (request.getAllocatedQuantity() != null) {
            quota.setAllocatedQuantity(request.getAllocatedQuantity());
        }
        if (request.getSoldQuantity() != null) {
            quota.setSoldQuantity(request.getSoldQuantity());
        }
        if (request.getIsActive() != null) {
            quota.setIsActive(request.getIsActive());
        }
        if (request.getValidFrom() != null) {
            quota.setValidFrom(request.getValidFrom());
        }
        if (request.getValidTo() != null) {
            quota.setValidTo(request.getValidTo());
        }
        if (request.getNotes() != null) {
            quota.setNotes(request.getNotes());
        }

        ProductStaffQuota saved = quotaRepository.save(quota);
        Long whId = saved.getWarehouse() != null ? saved.getWarehouse().getId() : 1L;
        BigDecimal whStock = stockService.getAvailableStock(whId, saved.getProduct().getId());
        BigDecimal tot = stockBalanceRepository.getTotalEnterpriseStockForProduct(saved.getProduct().getId());
        BigDecimal totalStock = tot != null ? tot : BigDecimal.ZERO;
        return ProductStaffQuotaDto.fromEntity(saved, totalStock, whStock);
    }

    @Transactional
    public void deleteQuota(Long id) {
        com.nbh.erp.security.SecurityUtils.enforceNoDelete("ProductStaffQuota", id);
    }

    @Transactional(readOnly = true)
    public QuotaCheckResultDto checkStaffProductQuota(Long productId, Long userId, Long warehouseId, BigDecimal requestedQty) {
        BigDecimal req = requestedQty != null ? requestedQty : BigDecimal.ONE;

        if (productId == null || userId == null) {
            return QuotaCheckResultDto.builder()
                    .quotaRestricted(false)
                    .isAllowed(true)
                    .requestedQuantity(req)
                    .message("No quota check needed (unassigned staff or product)")
                    .build();
        }

        List<ProductStaffQuota> activeQuotas = quotaRepository.findMatchingActiveQuotas(productId, userId, warehouseId);

        if (activeQuotas.isEmpty()) {
            return QuotaCheckResultDto.builder()
                    .quotaRestricted(false)
                    .isAllowed(true)
                    .requestedQuantity(req)
                    .message("No inventory allocation set for this staff member")
                    .build();
        }

        ProductStaffQuota quota = activeQuotas.get(0);

        // Date validity check
        LocalDate today = LocalDate.now();
        if (quota.getValidFrom() != null && today.isBefore(quota.getValidFrom())) {
            return QuotaCheckResultDto.builder()
                    .quotaRestricted(false)
                    .isAllowed(true)
                    .requestedQuantity(req)
                    .message("Allocation starts on " + quota.getValidFrom())
                    .build();
        }
        if (quota.getValidTo() != null && today.isAfter(quota.getValidTo())) {
            return QuotaCheckResultDto.builder()
                    .quotaRestricted(true)
                    .isAllowed(false)
                    .allocatedQuantity(quota.getAllocatedQuantity())
                    .soldQuantity(quota.getSoldQuantity())
                    .remainingQuantity(BigDecimal.ZERO)
                    .requestedQuantity(req)
                    .staffName(quota.getUser() != null ? quota.getUser().getFullName() : "Staff")
                    .productName(quota.getProduct() != null ? quota.getProduct().getName() : "Product")
                    .message("Allocation ended on " + quota.getValidTo())
                    .build();
        }

        BigDecimal remaining = quota.getRemainingQuantity();
        boolean allowed = remaining.compareTo(req) >= 0;

        String staffName = quota.getUser() != null ? (quota.getUser().getFullName() != null ? quota.getUser().getFullName() : quota.getUser().getUsername()) : "Staff";
        String prodName = quota.getProduct() != null ? quota.getProduct().getName() : "Product";

        String msg = allowed
                ? String.format("Allocation OK: %s has %s left (Allocated: %s, Sold: %s)",
                    staffName, remaining, quota.getAllocatedQuantity(), quota.getSoldQuantity())
                : String.format("Allocation Limit Reached: %s has only %s left for '%s' (Allocated: %s, Sold: %s). You entered: %s",
                    staffName, remaining, prodName, quota.getAllocatedQuantity(), quota.getSoldQuantity(), req);

        return QuotaCheckResultDto.builder()
                .quotaRestricted(true)
                .isAllowed(allowed)
                .allocatedQuantity(quota.getAllocatedQuantity())
                .soldQuantity(quota.getSoldQuantity())
                .remainingQuantity(remaining)
                .requestedQuantity(req)
                .staffName(staffName)
                .productName(prodName)
                .message(msg)
                .build();
    }

    /**
     * Validates that the sales rep has enough quota to sell the requested quantity.
     * Throws BusinessException if quota restriction is breached.
     */
    @Transactional(readOnly = true)
    public void validateStaffQuota(Long productId, Long userId, Long warehouseId, BigDecimal requestedQty) {
        QuotaCheckResultDto check = checkStaffProductQuota(productId, userId, warehouseId, requestedQty);
        if (check.isQuotaRestricted() && !check.isAllowed()) {
            throw new BusinessException(
                    String.format("Inventory Allocation Limit Reached: %s can only sell %s more of '%s' (Allocated: %s, Sold: %s). You entered: %s.",
                            check.getStaffName(),
                            check.getRemainingQuantity(),
                            check.getProductName(),
                            check.getAllocatedQuantity(),
                            check.getSoldQuantity(),
                            requestedQty)
            );
        }
    }

    /**
     * Records quota consumption upon invoice completion.
     */
    @Transactional
    public void consumeStaffQuota(Long productId, Long userId, Long warehouseId, BigDecimal quantity) {
        if (productId == null || userId == null || quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        List<ProductStaffQuota> activeQuotas = quotaRepository.findMatchingActiveQuotas(productId, userId, warehouseId);
        if (!activeQuotas.isEmpty()) {
            ProductStaffQuota quota = activeQuotas.get(0);
            BigDecimal currentSold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
            quota.setSoldQuantity(currentSold.add(quantity));
            quotaRepository.save(quota);
            log.info("Consumed {} units from quota ID {} for user {}. Total sold: {}/{}",
                    quantity, quota.getId(), userId, quota.getSoldQuantity(), quota.getAllocatedQuantity());
        }
    }

    /**
     * Reverses quota consumption when an invoice is voided or cancelled.
     */
    @Transactional
    public void restoreStaffQuota(Long productId, Long userId, Long warehouseId, BigDecimal quantity) {
        if (productId == null || userId == null || quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        List<ProductStaffQuota> activeQuotas = quotaRepository.findMatchingActiveQuotas(productId, userId, warehouseId);
        if (!activeQuotas.isEmpty()) {
            ProductStaffQuota quota = activeQuotas.get(0);
            BigDecimal currentSold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
            BigDecimal newSold = currentSold.subtract(quantity);
            if (newSold.compareTo(BigDecimal.ZERO) < 0) {
                newSold = BigDecimal.ZERO;
            }
            quota.setSoldQuantity(newSold);
            quotaRepository.save(quota);
            log.info("Restored {} units to quota ID {} for user {}. Total sold: {}/{}",
                    quantity, quota.getId(), userId, quota.getSoldQuantity(), quota.getAllocatedQuantity());
        }
    }

    @Transactional(readOnly = true)
    public QuotaSummaryDto getSummaryMetrics() {
        List<ProductStaffQuota> all = quotaRepository.findAll();
        long total = all.size();
        long active = all.stream().filter(q -> Boolean.TRUE.equals(q.getIsActive())).count();
        long exhausted = all.stream().filter(q -> Boolean.TRUE.equals(q.getIsActive()) && q.isExhausted()).count();

        BigDecimal totalAlloc = all.stream()
                .filter(q -> Boolean.TRUE.equals(q.getIsActive()))
                .map(q -> q.getAllocatedQuantity() != null ? q.getAllocatedQuantity() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSold = all.stream()
                .filter(q -> Boolean.TRUE.equals(q.getIsActive()))
                .map(q -> q.getSoldQuantity() != null ? q.getSoldQuantity() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRem = totalAlloc.subtract(totalSold);
        if (totalRem.compareTo(BigDecimal.ZERO) < 0) totalRem = BigDecimal.ZERO;

        long distinctProds = quotaRepository.countDistinctRestrictedProducts();
        long distinctStaff = quotaRepository.countDistinctRestrictedStaff();

        return QuotaSummaryDto.builder()
                .totalQuotas(total)
                .activeQuotas(active)
                .exhaustedQuotas(exhausted)
                .totalAllocatedUnits(totalAlloc)
                .totalSoldUnits(totalSold)
                .totalRemainingUnits(totalRem)
                .distinctProductsRestricted(distinctProds)
                .distinctStaffRestricted(distinctStaff)
                .build();
    }
}
