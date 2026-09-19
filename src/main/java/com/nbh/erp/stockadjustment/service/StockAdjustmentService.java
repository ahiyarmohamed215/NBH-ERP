package com.nbh.erp.stockadjustment.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.stockadjustment.dto.CreateStockAdjustmentRequest;
import com.nbh.erp.stockadjustment.dto.StockAdjustmentDto;
import com.nbh.erp.stockadjustment.entity.StockAdjustment;
import com.nbh.erp.stockadjustment.entity.StockAdjustmentItem;
import com.nbh.erp.stockadjustment.repository.StockAdjustmentRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockAdjustmentService {

    private final StockAdjustmentRepository adjustmentRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

    @Transactional(readOnly = true)
    public PagedResponse<StockAdjustmentDto> searchAdjustments(
            Long warehouseId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<StockAdjustmentDto> page = adjustmentRepository.searchAdjustments(warehouseId, status, query, pageable)
                .map(StockAdjustmentDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public StockAdjustmentDto getAdjustmentById(Long id) {
        StockAdjustment sa = adjustmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock Adjustment", "id", id));
        return StockAdjustmentDto.from(sa);
    }

    @Transactional
    public StockAdjustmentDto createAdjustment(CreateStockAdjustmentRequest request, boolean autoProcess) {
        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        String adjustmentNumber = sequenceService.generateAdjustmentNumber();

        StockAdjustment adjustment = StockAdjustment.builder()
                .adjustmentNumber(adjustmentNumber)
                .warehouse(warehouse)
                .adjustmentDate(request.getAdjustmentDate())
                .reason(request.getReason())
                .status("DRAFT")
                .items(new ArrayList<>())
                .build();

        for (CreateStockAdjustmentRequest.CreateStockAdjustmentItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal systemQty = stockService.getAvailableStock(warehouse.getId(), product.getId());
            BigDecimal diff = itemReq.getPhysicalQuantity().subtract(systemQty);

            StockAdjustmentItem item = StockAdjustmentItem.builder()
                    .stockAdjustment(adjustment)
                    .product(product)
                    .systemQuantity(systemQty)
                    .physicalQuantity(itemReq.getPhysicalQuantity())
                    .differenceQuantity(diff)
                    .unitCost(product.getCostPrice())
                    .reason(itemReq.getReason())
                    .build();

            adjustment.getItems().add(item);
        }

        StockAdjustment saved = adjustmentRepository.save(adjustment);

        if (autoProcess) {
            return processAdjustmentInternal(saved);
        }

        return StockAdjustmentDto.from(saved);
    }

    @Transactional
    public StockAdjustmentDto processAdjustment(Long id) {
        StockAdjustment adjustment = adjustmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock Adjustment", "id", id));
        return processAdjustmentInternal(adjustment);
    }

    private StockAdjustmentDto processAdjustmentInternal(StockAdjustment adjustment) {
        if ("PROCESSED".equals(adjustment.getStatus())) {
            throw new BusinessException("Adjustment " + adjustment.getAdjustmentNumber() + " is already processed");
        }
        if ("REJECTED".equals(adjustment.getStatus())) {
            throw new BusinessException("Cannot process rejected adjustment " + adjustment.getAdjustmentNumber());
        }

        Long warehouseId = adjustment.getWarehouse().getId();
        String currentUsername = SecurityUtils.getCurrentUsername().orElse("system");

        for (StockAdjustmentItem item : adjustment.getItems()) {
            stockService.adjustStock(
                    warehouseId,
                    item.getProduct().getId(),
                    item.getPhysicalQuantity(),
                    adjustment.getAdjustmentNumber(),
                    "Stock Audit Adjustment. Diff: " + item.getDifferenceQuantity() +
                            (item.getReason() != null ? " (" + item.getReason() + ")" : "")
            );
        }

        adjustment.setStatus("PROCESSED");
        adjustment.setApprovedBy(currentUsername);
        adjustment.setApprovedAt(LocalDateTime.now());
        StockAdjustment updated = adjustmentRepository.save(adjustment);

        log.info("Stock Adjustment '{}' processed successfully by {}", adjustment.getAdjustmentNumber(), currentUsername);
        return StockAdjustmentDto.from(updated);
    }

    @Transactional
    public void rejectAdjustment(Long id) {
        StockAdjustment adjustment = adjustmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock Adjustment", "id", id));

        if (!"DRAFT".equals(adjustment.getStatus())) {
            throw new BusinessException("Only draft stock adjustments can be rejected");
        }

        adjustment.setStatus("REJECTED");
        adjustmentRepository.save(adjustment);
    }
}
