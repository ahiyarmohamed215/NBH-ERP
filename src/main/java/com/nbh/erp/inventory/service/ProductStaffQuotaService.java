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
    @org.springframework.beans.factory.annotation.Autowired private com.nbh.erp.recyclebin.RecycleBinService recycleBin;

    private final ProductStaffQuotaRepository quotaRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final StockService stockService;
    private final StockBalanceRepository stockBalanceRepository;
    private final com.nbh.erp.audit.service.AuditLogService audit;

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
        String target = request.getStatus() != null ? request.getStatus() : "ACTIVE";
        if (!java.util.Set.of("DRAFT", "ACTIVE").contains(target)) throw new BusinessException("New allocations must be draft or active");
        Product product = request.getProductId() == null ? null : productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));
        User user = request.getUserId() == null ? null : userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));
        Warehouse warehouse = request.getWarehouseId() == null ? product != null ? product.getDefaultWarehouse() : null : warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));
        ProductStaffQuota quota = ProductStaffQuota.builder()
                .product(product)
                .user(user)
                .warehouse(warehouse)
                .allocatedQuantity(request.getAllocatedQuantity())
                .soldQuantity(BigDecimal.ZERO)
                .notes(request.getNotes())
                .validFrom(request.getValidFrom())
                .validTo(request.getValidTo())
                .build();
        validateAllocation(quota, target);
        quota.setAllocationStatus(target);
        quota.setIsActive("ACTIVE".equals(target));
        ProductStaffQuota saved = quotaRepository.save(quota);
        audit.log("ALLOCATION_CREATE", "ProductStaffQuota", String.valueOf(saved.getId()), "Saved " + target + " allocation");
        return allocationDto(saved);
    }

    @Transactional
    public ProductStaffQuotaDto updateQuota(Long id, UpdateProductStaffQuotaRequest request) {
        ProductStaffQuota quota = quotaRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProductStaffQuota", "id", id));
        String previous = quota.getAllocationStatus();
        String target = request.getStatus() != null ? request.getStatus() : request.getIsActive() != null ? request.getIsActive() ? "ACTIVE" : "INACTIVE" : previous;
        if (!java.util.Set.of("DRAFT", "ACTIVE", "INACTIVE").contains(target)) throw new BusinessException("Invalid allocation status");
        if (!previous.equals(target) && (request.getStatusReason() == null || request.getStatusReason().isBlank())) throw new BusinessException("Enter a reason for this status change");
        BigDecimal sold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
        if ("DRAFT".equals(target) && sold.signum() > 0) throw new BusinessException("An allocation with sales cannot be returned to draft");
        boolean replaceDraftFields = Boolean.TRUE.equals(request.getReplaceDraftFields());
        if (replaceDraftFields || request.getProductId() != null || request.getUserId() != null) {
            if (!"DRAFT".equals(previous)) throw new BusinessException("Only draft allocations can change their product or staff");
            if (replaceDraftFields && request.getProductId() == null) {quota.setProduct(null);quota.setWarehouse(null);}
            if (request.getProductId() != null) {
                Product product = productRepository.findById(request.getProductId()).orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));
                quota.setProduct(product);quota.setWarehouse(product.getDefaultWarehouse());
            }
            if (replaceDraftFields && request.getUserId() == null) quota.setUser(null);
            if (request.getUserId() != null) quota.setUser(userRepository.findById(request.getUserId()).orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId())));
        }
        if (replaceDraftFields && request.getAllocatedQuantity() == null) quota.setAllocatedQuantity(null);
        if (request.getAllocatedQuantity() != null) {
            if (request.getAllocatedQuantity().compareTo(sold) < 0) throw new BusinessException("Allocated quantity cannot be less than quantity already sold");
            quota.setAllocatedQuantity(request.getAllocatedQuantity());
        }
        if (request.getSoldQuantity() != null) quota.setSoldQuantity(request.getSoldQuantity());
        if (request.getNotes() != null) quota.setNotes(request.getNotes());
        if (request.getValidFrom() != null) quota.setValidFrom(request.getValidFrom());
        if (request.getValidTo() != null) quota.setValidTo(request.getValidTo());
        // Deactivating does not require stock. Activation and active quantity edits do.
        if (!"INACTIVE".equals(target) && (!previous.equals(target) || request.getAllocatedQuantity() != null || "DRAFT".equals(target))) validateAllocation(quota,target);
        quota.setAllocationStatus(target);quota.setIsActive("ACTIVE".equals(target));
        if (!previous.equals(target)) audit.log("ALLOCATION_STATUS", "ProductStaffQuota", String.valueOf(id), previous + " → " + target + ": " + request.getStatusReason().trim());
        return allocationDto(quotaRepository.save(quota));
    }

    private void validateAllocation(ProductStaffQuota quota,String target) {
        BigDecimal quantity = quota.getAllocatedQuantity();
        if ("DRAFT".equals(target)) {
            if (quota.getProduct() == null && quota.getUser() == null && quantity == null && (quota.getNotes() == null || quota.getNotes().isBlank())) throw new BusinessException("Fill at least one input before saving a draft");
            return;
        }
        if (quota.getProduct() == null || quota.getUser() == null || quantity == null || quantity.signum() <= 0) throw new BusinessException("Complete product, staff and allocated quantity before activation");
        BigDecimal available = quota.getWarehouse() != null ? stockService.getAvailableStock(quota.getWarehouse().getId(),quota.getProduct().getId()) : stockBalanceRepository.getTotalEnterpriseStockForProduct(quota.getProduct().getId());
        if (available == null) available = BigDecimal.ZERO;
        BigDecimal sold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
        BigDecimal remaining = quantity.subtract(sold);
        if (remaining.compareTo(available) > 0) throw new BusinessException("Cannot allocate: only " + available + " units are available in inventory");
    }

    private ProductStaffQuotaDto allocationDto(ProductStaffQuota quota) {
        if (quota.getProduct() == null) return ProductStaffQuotaDto.fromEntity(quota,BigDecimal.ZERO,BigDecimal.ZERO);
        BigDecimal total = stockBalanceRepository.getTotalEnterpriseStockForProduct(quota.getProduct().getId());
        BigDecimal warehouseStock = quota.getWarehouse() == null ? total : stockService.getAvailableStock(quota.getWarehouse().getId(),quota.getProduct().getId());
        return ProductStaffQuotaDto.fromEntity(quota,total,warehouseStock);
    }

    @Transactional
    public void deleteQuota(Long id) {
        recycleBin.delete("ALLOCATION", id);
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

        LocalDate today = LocalDate.now();
        List<ProductStaffQuota> validQuotas = activeQuotas.stream()
                .filter(q -> (q.getValidFrom() == null || !today.isBefore(q.getValidFrom()))
                          && (q.getValidTo() == null || !today.isAfter(q.getValidTo())))
                .toList();

        if (validQuotas.isEmpty()) {
            ProductStaffQuota sample = activeQuotas.get(0);
            if (sample.getValidFrom() != null && today.isBefore(sample.getValidFrom())) {
                return QuotaCheckResultDto.builder()
                        .quotaRestricted(false)
                        .isAllowed(true)
                        .requestedQuantity(req)
                        .message("Allocation starts on " + sample.getValidFrom())
                        .build();
            }
            return QuotaCheckResultDto.builder()
                    .quotaRestricted(true)
                    .isAllowed(false)
                    .allocatedQuantity(sample.getAllocatedQuantity())
                    .soldQuantity(sample.getSoldQuantity())
                    .remainingQuantity(BigDecimal.ZERO)
                    .requestedQuantity(req)
                    .staffName(sample.getUser() != null ? sample.getUser().getFullName() : "Staff")
                    .productName(sample.getProduct() != null ? sample.getProduct().getName() : "Product")
                    .message("Allocation ended on " + sample.getValidTo())
                    .build();
        }

        BigDecimal totalAllocated = validQuotas.stream()
                .map(q -> q.getAllocatedQuantity() != null ? q.getAllocatedQuantity() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSold = validQuotas.stream()
                .map(q -> q.getSoldQuantity() != null ? q.getSoldQuantity() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRemaining = validQuotas.stream()
                .map(ProductStaffQuota::getRemainingQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean allowed = totalRemaining.compareTo(req) >= 0;

        ProductStaffQuota primary = validQuotas.get(0);
        String staffName = primary.getUser() != null ? (primary.getUser().getFullName() != null ? primary.getUser().getFullName() : primary.getUser().getUsername()) : "Staff";
        String prodName = primary.getProduct() != null ? primary.getProduct().getName() : "Product";

        String msg = allowed
                ? String.format("Allocation OK: %s has %s left (Allocated: %s, Sold: %s)",
                    staffName, totalRemaining, totalAllocated, totalSold)
                : String.format("Allocation Limit Reached: %s has only %s left for '%s' (Allocated: %s, Sold: %s). You entered: %s",
                    staffName, totalRemaining, prodName, totalAllocated, totalSold, req);

        return QuotaCheckResultDto.builder()
                .quotaRestricted(true)
                .isAllowed(allowed)
                .allocatedQuantity(totalAllocated)
                .soldQuantity(totalSold)
                .remainingQuantity(totalRemaining)
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
     * Consumes sequentially across active allocations for the product and user.
     */
    @Transactional
    public void consumeStaffQuota(Long productId, Long userId, Long warehouseId, BigDecimal quantity) {
        recordQuotaSale(productId,userId,warehouseId,quantity,true);
    }

    /** POS already validated/reserved this quantity. Office invoicing only records the sale. */
    @Transactional
    public void recordHeldStaffQuota(Long productId, Long userId, Long warehouseId, BigDecimal quantity) {
        recordQuotaSale(productId,userId,warehouseId,quantity,false);
    }

    private void recordQuotaSale(Long productId, Long userId, Long warehouseId, BigDecimal quantity, boolean enforceLimit) {
        if (productId == null || userId == null || quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        List<ProductStaffQuota> activeQuotas = quotaRepository.lockMatchingActiveQuotas(productId, userId, warehouseId);
        // No effective allocation means unrestricted sales, matching POS validation.
        if(enforceLimit){
            if (!checkStaffProductQuota(productId, userId, warehouseId, quantity).isQuotaRestricted()) return;
            validateStaffQuota(productId, userId, warehouseId, quantity);
        }
        LocalDate today = LocalDate.now();
        var effective=activeQuotas.stream().filter(quota->(quota.getValidFrom()==null || !today.isBefore(quota.getValidFrom())) && (quota.getValidTo()==null || !today.isAfter(quota.getValidTo()))).toList();
        if(!enforceLimit && effective.isEmpty())return;
        BigDecimal remainingToConsume = quantity;
        for (ProductStaffQuota quota : effective) {
            if (remainingToConsume.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal quotaRemaining = quota.getRemainingQuantity();
            if (quotaRemaining.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal consumeFromThis = remainingToConsume.min(quotaRemaining);
            BigDecimal currentSold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
            quota.setSoldQuantity(currentSold.add(consumeFromThis));
            remainingToConsume = remainingToConsume.subtract(consumeFromThis);
            quotaRepository.save(quota);
            log.info("Consumed {} units from quota ID {} for user {}. Total sold: {}/{}",
                    consumeFromThis, quota.getId(), userId, quota.getSoldQuantity(), quota.getAllocatedQuantity());
        }
        if (remainingToConsume.compareTo(BigDecimal.ZERO) > 0) {
            if(enforceLimit)throw new BusinessException("Staff quota exceeded");
            // Allocation edits after POS submission cannot block warehouse-approved invoicing.
            // Keep the actual sold quantity, even when the revised allocation is now smaller.
            var last=effective.getLast();
            last.setSoldQuantity((last.getSoldQuantity()==null?BigDecimal.ZERO:last.getSoldQuantity()).add(remainingToConsume));
            quotaRepository.save(last);
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

        List<ProductStaffQuota> activeQuotas = quotaRepository.lockMatchingActiveQuotas(productId, userId, warehouseId);
        BigDecimal remainingToRestore = quantity;
        for (ProductStaffQuota quota : activeQuotas) {
            if (remainingToRestore.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal currentSold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
            if (currentSold.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal restoreToThis = remainingToRestore.min(currentSold);
            quota.setSoldQuantity(currentSold.subtract(restoreToThis));
            remainingToRestore = remainingToRestore.subtract(restoreToThis);
            quotaRepository.save(quota);
            log.info("Restored {} units to quota ID {} for user {}. Total sold: {}/{}",
                    restoreToThis, quota.getId(), userId, quota.getSoldQuantity(), quota.getAllocatedQuantity());
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

    @Transactional(readOnly = true)
    public ProductStockAvailabilityDto getProductStockAvailability(Long productId, Long warehouseId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        Warehouse warehouse = null;
        if (warehouseId != null) {
            warehouse = warehouseRepository.findById(warehouseId).orElse(null);
        }
        if (warehouse == null && product.getDefaultWarehouse() != null) {
            warehouse = product.getDefaultWarehouse();
        }

        BigDecimal availableStock;
        if (warehouse != null) {
            availableStock = stockService.getAvailableStock(warehouse.getId(), product.getId());
        } else {
            BigDecimal tot = stockBalanceRepository.getTotalEnterpriseStockForProduct(product.getId());
            availableStock = tot != null ? tot : BigDecimal.ZERO;
        }
        if (availableStock == null) {
            availableStock = BigDecimal.ZERO;
        }

        BigDecimal totEnterprise = stockBalanceRepository.getTotalEnterpriseStockForProduct(product.getId());
        BigDecimal totalEnterpriseStock = totEnterprise != null ? totEnterprise : BigDecimal.ZERO;

        boolean isOutOfStock = availableStock.compareTo(BigDecimal.ZERO) <= 0;

        return ProductStockAvailabilityDto.builder()
                .productId(product.getId())
                .productName(product.getName())
                .productSku(product.getSku())
                .warehouseId(warehouse != null ? warehouse.getId() : null)
                .availableStock(availableStock)
                .totalEnterpriseStock(totalEnterpriseStock)
                .outOfStock(isOutOfStock)
                .build();
    }
}
