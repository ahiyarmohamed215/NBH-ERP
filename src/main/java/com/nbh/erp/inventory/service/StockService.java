package com.nbh.erp.inventory.service;

import com.nbh.erp.common.exception.InsufficientStockException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.inventory.dto.StockDto;
import com.nbh.erp.inventory.dto.StockMovementDto;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.entity.StockMovement;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.inventory.repository.StockMovementRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.security.SecurityUtils;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockService {

    private final StockBalanceRepository stockBalanceRepository;
    private final StockMovementRepository stockMovementRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final com.nbh.erp.accounting.service.AccountingService accounting;

    @Transactional(readOnly = true)
    public BigDecimal getAvailableStock(Long warehouseId, Long productId) {
        return stockBalanceRepository.findByWarehouseIdAndProductId(warehouseId, productId)
                .map(StockBalance::getAvailableQuantity)
                .orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public StockDto getStockBalance(Long warehouseId, Long productId) {
        StockBalance balance = stockBalanceRepository.findByWarehouseIdAndProductId(warehouseId, productId)
                .orElseGet(() -> {
                    Warehouse wh = warehouseRepository.findById(warehouseId)
                            .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
                    Product prd = productRepository.findById(productId)
                            .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));
                    return StockBalance.builder()
                            .warehouse(wh)
                            .product(prd)
                            .quantity(BigDecimal.ZERO)
                            .reservedQuantity(BigDecimal.ZERO)
                            .build();
                });
        return StockDto.from(balance);
    }

    @Transactional(readOnly = true)
    public List<StockDto> getStockByWarehouse(Long warehouseId) {
        return stockBalanceRepository.findByWarehouseId(warehouseId).stream()
                .map(StockDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public StockBalance increaseStock(
            Long warehouseId,
            Long productId,
            BigDecimal quantity,
            BigDecimal unitCost,
            String referenceType,
            String referenceNumber,
            String notes
    ) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Quantity to increase must be positive");
        }

        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        StockBalance stockBalance = stockBalanceRepository.findByWarehouseIdAndProductIdForUpdate(warehouseId, productId)
                .orElseGet(() -> StockBalance.builder()
                        .warehouse(warehouse)
                        .product(product)
                        .quantity(BigDecimal.ZERO)
                        .reservedQuantity(BigDecimal.ZERO)
                        .build()
                );

        BigDecimal before = stockBalance.getQuantity() != null ? stockBalance.getQuantity() : BigDecimal.ZERO;
        BigDecimal after = before.add(quantity);
        stockBalance.setQuantity(after);

        StockBalance savedBalance = stockBalanceRepository.save(stockBalance);

        // Update product cost price if provided and valid
        if ("GRN".equals(referenceType) && unitCost != null && unitCost.compareTo(BigDecimal.ZERO) > 0) {
            product.setCostPrice(unitCost);
            productRepository.save(product);
        }

        recordMovement(
                warehouse,
                product,
                referenceType,
                quantity,
                before,
                after,
                unitCost != null ? unitCost : product.getCostPrice(),
                referenceType,
                referenceNumber,
                notes
        );

        log.info("Stock increased: Product '{}' (ID {}) in Warehouse '{}' (ID {}): {} -> {} (ref: {})",
                product.getName(), productId, warehouse.getName(), warehouseId, before, after, referenceNumber);

        return savedBalance;
    }

    @Transactional
    public StockBalance decreaseStock(Long warehouseId, Long productId, BigDecimal quantity,
            String referenceType, String referenceNumber, String notes) {
        return decreaseStock(warehouseId, productId, quantity, null, referenceType, referenceNumber, notes);
    }

    @Transactional
    public StockBalance decreaseStock(
            Long warehouseId,
            Long productId,
            BigDecimal quantity,
            BigDecimal unitCost,
            String referenceType,
            String referenceNumber,
            String notes
    ) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Quantity to decrease must be positive");
        }

        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        StockBalance stockBalance = stockBalanceRepository.findByWarehouseIdAndProductIdForUpdate(warehouseId, productId)
                .orElseThrow(() -> new InsufficientStockException(productId, warehouseId, BigDecimal.ZERO, quantity));

        BigDecimal available = stockBalance.getAvailableQuantity();
        if (available.compareTo(quantity) < 0) {
            throw new InsufficientStockException(productId, warehouseId, available, quantity);
        }

        BigDecimal before = stockBalance.getQuantity();
        BigDecimal after = before.subtract(quantity);
        stockBalance.setQuantity(after);

        StockBalance savedBalance = stockBalanceRepository.save(stockBalance);

        recordMovement(
                warehouse,
                product,
                referenceType,
                quantity.negate(),
                before,
                after,
                unitCost != null ? unitCost : product.getCostPrice(),
                referenceType,
                referenceNumber,
                notes
        );

        log.info("Stock decreased: Product '{}' (ID {}) in Warehouse '{}' (ID {}): {} -> {} (ref: {})",
                product.getName(), productId, warehouse.getName(), warehouseId, before, after, referenceNumber);

        return savedBalance;
    }

    @Transactional
    public void transferStock(
            Long sourceWarehouseId,
            Long destinationWarehouseId,
            Long productId,
            BigDecimal quantity,
            String referenceNumber,
            String notes
    ) {
        if (sourceWarehouseId.equals(destinationWarehouseId)) {
            throw new IllegalArgumentException("Source and destination warehouse cannot be the same");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        decreaseStock(
                sourceWarehouseId,
                productId,
                quantity,
                "GTN_OUT",
                referenceNumber,
                "Transferred to warehouse ID " + destinationWarehouseId + (notes != null ? " - " + notes : "")
        );

        increaseStock(
                destinationWarehouseId,
                productId,
                quantity,
                product.getCostPrice(),
                "GTN_IN",
                referenceNumber,
                "Received from warehouse ID " + sourceWarehouseId + (notes != null ? " - " + notes : "")
        );
    }

    @Transactional
    public StockBalance adjustStock(
            Long warehouseId,
            Long productId,
            BigDecimal physicalQuantity,
            String referenceNumber,
            String reason
    ) {
        if (physicalQuantity == null || physicalQuantity.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Physical quantity cannot be negative");
        }

        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        StockBalance stockBalance = stockBalanceRepository.findByWarehouseIdAndProductIdForUpdate(warehouseId, productId)
                .orElseGet(() -> StockBalance.builder()
                        .warehouse(warehouse)
                        .product(product)
                        .quantity(BigDecimal.ZERO)
                        .reservedQuantity(BigDecimal.ZERO)
                        .build()
                );

        BigDecimal before = stockBalance.getQuantity() != null ? stockBalance.getQuantity() : BigDecimal.ZERO;
        BigDecimal difference = physicalQuantity.subtract(before);

        if (difference.compareTo(BigDecimal.ZERO) == 0) {
            return stockBalance;
        }

        stockBalance.setQuantity(physicalQuantity);
        StockBalance saved = stockBalanceRepository.save(stockBalance);

        recordMovement(
                warehouse,
                product,
                "ADJUSTMENT",
                difference,
                before,
                physicalQuantity,
                product.getCostPrice(),
                "STOCK_ADJUSTMENT",
                referenceNumber,
                reason
        );

        log.info("Stock adjusted: Product '{}' in Warehouse '{}': {} -> {} diff: {} (ref: {})",
                product.getName(), warehouse.getName(), before, physicalQuantity, difference, referenceNumber);

        return saved;
    }

    private void recordMovement(
            Warehouse warehouse,
            Product product,
            String movementType,
            BigDecimal quantity,
            BigDecimal before,
            BigDecimal after,
            BigDecimal unitCost,
            String referenceType,
            String referenceNumber,
            String notes
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId().orElse(null);

        StockMovement movement = StockMovement.builder()
                .warehouse(warehouse)
                .product(product)
                .movementType(movementType)
                .quantity(quantity)
                .balanceBefore(before)
                .balanceAfter(after)
                .unitCost(unitCost != null ? unitCost : BigDecimal.ZERO)
                .referenceType(referenceType)
                .referenceNumber(referenceNumber)
                .notes(notes)
                .createdByUserId(currentUserId)
                .build();

        stockMovementRepository.save(movement);
        BigDecimal value=quantity.abs().multiply(movement.getUnitCost()).setScale(2,java.math.RoundingMode.HALF_UP);
        String opposite=switch(referenceType) {
            case "GRN", "GRN_CANCEL", "PRN" -> "AP";
            case "SALE", "SALE_RETURN", "VOID_SALE" -> "COGS";
            case "STOCK_ADJUSTMENT" -> "ADJUSTMENTS";
            default -> null;
        };
        if(opposite!=null) accounting.transfer("STOCK-"+movement.getId(),LocalDate.now(),referenceType+" "+referenceNumber,"STOCK",
            quantity.signum()>0 ? "INVENTORY" : opposite,quantity.signum()>0 ? opposite : "INVENTORY",value);
    }

    @Transactional(readOnly = true)
    public Page<StockDto> searchBalances(Long warehouseId, String query, Pageable pageable) {
        return stockBalanceRepository.searchBalances(warehouseId, query, pageable).map(StockDto::from);
    }

    @Transactional(readOnly = true)
    public List<StockDto> findLowStock(Long warehouseId) {
        return (warehouseId != null
                ? stockBalanceRepository.findLowStockInWarehouse(warehouseId)
                : stockBalanceRepository.findAllLowStock())
                .stream()
                .map(StockDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<StockMovementDto> getLedger(
            Long warehouseId,
            Long productId,
            String movementType,
            LocalDate startDate,
            LocalDate endDate,
            Pageable pageable
    ) {
        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime endDateTime = endDate != null ? endDate.atTime(23, 59, 59) : null;

        return stockMovementRepository
                .findLedger(warehouseId, productId, movementType, startDateTime, endDateTime, pageable)
                .map(StockMovementDto::from);
    }
}
