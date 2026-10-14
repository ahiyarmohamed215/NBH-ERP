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
        Optional<ProductStaffQuota> existing = matchingAllocation(product,user,warehouse);
        ProductStaffQuota quota = existing.orElseGet(() -> ProductStaffQuota.builder().product(product).user(user).warehouse(warehouse).soldQuantity(BigDecimal.ZERO).build());
        if (existing.isPresent() && !target.equals(quota.getAllocationStatus())) throw new BusinessException("An allocation already exists. Open it to change its status");
        BigDecimal sold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
        if (request.getAllocatedQuantity() != null && request.getAllocatedQuantity().compareTo(sold) < 0) throw new BusinessException("Allocated quantity cannot be less than quantity already sold");
        quota.setAllocatedQuantity(request.getAllocatedQuantity());
        quota.setNotes(request.getNotes());
        quota.setValidFrom(request.getValidFrom());quota.setValidTo(request.getValidTo());
        validateAllocation(quota,target);
        quota.setAllocationStatus(target);quota.setIsActive("ACTIVE".equals(target));
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
            Optional<ProductStaffQuota> duplicate = matchingAllocation(quota.getProduct(),quota.getUser(),quota.getWarehouse());
            if (duplicate.isPresent() && !duplicate.get().getId().equals(id)) throw new BusinessException("An allocation already exists for this product and staff");
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

    private Optional<ProductStaffQuota> matchingAllocation(Product product,User user,Warehouse warehouse) {
        if (product == null || user == null) return Optional.empty();
        var match = warehouse != null ? quotaRepository.findByProductIdAndUserIdAndWarehouseId(product.getId(),user.getId(),warehouse.getId())
                : quotaRepository.findByProductIdAndUserIdAndWarehouseIsNull(product.getId(),user.getId());
        if(match.isPresent() && match.get().isDeleted()) throw new BusinessException("This allocation was deleted. Restore it from the recycle bin before making changes");
        return match;
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

        validateStaffQuota(productId,userId,warehouseId,quantity);
        List<ProductStaffQuota> activeQuotas = quotaRepository.lockMatchingActiveQuotas(productId, userId, warehouseId);
        if (!activeQuotas.isEmpty()) {
            ProductStaffQuota quota = activeQuotas.get(0);
            BigDecimal currentSold = quota.getSoldQuantity() != null ? quota.getSoldQuantity() : BigDecimal.ZERO;
            if(currentSold.add(quantity).compareTo(quota.getAllocatedQuantity())>0) throw new BusinessException("Staff quota exceeded");
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

        List<ProductStaffQuota> activeQuotas = quotaRepository.lockMatchingActiveQuotas(productId, userId, warehouseId);
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
