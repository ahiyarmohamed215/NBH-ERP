package com.nbh.erp.grn.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.dto.CreateGrnRequest;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.nbh.erp.security.SecurityUtils;
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
public class GrnService {

    private final GrnRepository grnRepository;
    private final SupplierRepository supplierRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PagedResponse<GrnDto> searchGrns(
            Long warehouseId,
            Long supplierId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<GrnDto> page = grnRepository.searchGrns(warehouseId, supplierId, status, query, pageable).map(GrnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public GrnDto getGrnById(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        return GrnDto.from(grn);
    }

    @Transactional
    public GrnDto createGrn(CreateGrnRequest request, boolean autoProcess) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        String grnNumber = sequenceService.generateGrnNumber();

        Grn grn = Grn.builder()
                .grnNumber(grnNumber)
                .supplier(supplier)
                .warehouse(warehouse)
                .supplierInvoiceNumber(request.getSupplierInvoiceNumber())
                .receivedDate(request.getReceivedDate())
                .notes(request.getNotes())
                .status("DRAFT")
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        BigDecimal grandTotal = BigDecimal.ZERO;

        for (CreateGrnRequest.CreateGrnItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal totalCost = itemReq.getQuantityReceived().multiply(itemReq.getUnitCost());
            grandTotal = grandTotal.add(totalCost);

            GrnItem item = GrnItem.builder()
                    .grn(grn)
                    .product(product)
                    .quantityReceived(itemReq.getQuantityReceived())
                    .unitCost(itemReq.getUnitCost())
                    .totalCost(totalCost)
                    .notes(itemReq.getNotes())
                    .build();

            grn.getItems().add(item);
        }

        grn.setTotalAmount(grandTotal);
        Grn savedGrn = grnRepository.save(grn);

        if (autoProcess) {
            return processGrnInternal(savedGrn);
        }

        return GrnDto.from(savedGrn);
    }

    @Transactional
    public GrnDto updateGrn(Long id, CreateGrnRequest request, boolean autoProcess) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));

        if (!"DRAFT".equals(grn.getStatus())) {
            throw new BusinessException("Only DRAFT GRNs can be edited. GRN " + grn.getGrnNumber() + " is " + grn.getStatus());
        }

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        grn.setSupplier(supplier);
        grn.setWarehouse(warehouse);
        grn.setSupplierInvoiceNumber(request.getSupplierInvoiceNumber());
        grn.setReceivedDate(request.getReceivedDate());
        grn.setNotes(request.getNotes());

        // Replace existing line items
        grn.getItems().clear();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (CreateGrnRequest.CreateGrnItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal totalCost = itemReq.getQuantityReceived().multiply(itemReq.getUnitCost());
            grandTotal = grandTotal.add(totalCost);

            GrnItem item = GrnItem.builder()
                    .grn(grn)
                    .product(product)
                    .quantityReceived(itemReq.getQuantityReceived())
                    .unitCost(itemReq.getUnitCost())
                    .totalCost(totalCost)
                    .notes(itemReq.getNotes())
                    .build();

            grn.getItems().add(item);
        }

        grn.setTotalAmount(grandTotal);
        Grn savedGrn = grnRepository.save(grn);

        if (autoProcess) {
            return processGrnInternal(savedGrn);
        }

        return GrnDto.from(savedGrn);
    }

    @Transactional
    public void deleteGrn(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));

        if (!"DRAFT".equals(grn.getStatus())) {
            throw new BusinessException("Only un-processed DRAFT GRNs can be deleted. GRN " + grn.getGrnNumber() + " is " + grn.getStatus());
        }

        grnRepository.delete(grn);
    }

    @Transactional
    public GrnDto processGrn(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        return processGrnInternal(grn);
    }

    @Transactional
    public GrnDto cancelGrn(Long id, String reason) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));

        if ("CANCELLED".equals(grn.getStatus())) {
            throw new BusinessException("GRN " + grn.getGrnNumber() + " is already cancelled");
        }

        if (reason == null || reason.trim().isEmpty()) {
            throw new BusinessException("Cancellation reason is required to cancel GRN " + grn.getGrnNumber());
        }

        String trimmedReason = reason.trim();
        Long warehouseId = grn.getWarehouse().getId();

        // If the GRN was PROCESSED, reverse inventory
        if ("PROCESSED".equals(grn.getStatus())) {
            // First pass: Pre-check that every received product has sufficient available stock in this warehouse
            for (GrnItem item : grn.getItems()) {
                BigDecimal available = stockService.getAvailableStock(warehouseId, item.getProduct().getId());
                if (available.compareTo(item.getQuantityReceived()) < 0) {
                    throw new BusinessException(String.format(
                            "Cannot cancel GRN %s: Insufficient stock for product '%s' (%s) in warehouse '%s'. Required to reverse: %s, Currently available in stock: %s",
                            grn.getGrnNumber(),
                            item.getProduct().getName(),
                            item.getProduct().getSku(),
                            grn.getWarehouse().getName(),
                            item.getQuantityReceived(),
                            available
                    ));
                }
            }

            // Second pass: Reverse stock for all line items
            for (GrnItem item : grn.getItems()) {
                stockService.decreaseStock(
                        warehouseId,
                        item.getProduct().getId(),
                        item.getQuantityReceived(),
                        "GRN_CANCEL",
                        grn.getGrnNumber(),
                        "Cancellation of GRN " + grn.getGrnNumber() + " - Reason: " + trimmedReason
                );
            }
        }

        String currentUsername = SecurityUtils.getCurrentUsername().orElse("SYSTEM");

        grn.setStatus("CANCELLED");
        grn.setCancelledAt(LocalDateTime.now());
        grn.setCancelledBy(currentUsername);
        grn.setCancelReason(trimmedReason);

        Grn saved = grnRepository.save(grn);

        auditLogService.log(
                "GRN_CANCEL",
                "Grn",
                grn.getGrnNumber(),
                String.format("GRN %s cancelled by '%s'. Reason: %s",
                        grn.getGrnNumber(), currentUsername, trimmedReason)
        );

        log.info("GRN '{}' cancelled successfully by '{}'. Reason: {}", grn.getGrnNumber(), currentUsername, trimmedReason);

        return GrnDto.from(saved);
    }

    private GrnDto processGrnInternal(Grn grn) {
        if (!"DRAFT".equals(grn.getStatus())) {
            throw new BusinessException("Only DRAFT GRNs can be processed. GRN " + grn.getGrnNumber() + " is " + grn.getStatus());
        }

        Long warehouseId = grn.getWarehouse().getId();

        for (GrnItem item : grn.getItems()) {
            stockService.increaseStock(
                    warehouseId,
                    item.getProduct().getId(),
                    item.getQuantityReceived(),
                    item.getUnitCost(),
                    "GRN",
                    grn.getGrnNumber(),
                    "Supplier: " + grn.getSupplier().getName() + " (Inv: " + grn.getSupplierInvoiceNumber() + ")"
            );
        }

        grn.setStatus("PROCESSED");
        Grn updated = grnRepository.save(grn);

        auditLogService.log(
                "GRN_PROCESS",
                "Grn",
                grn.getGrnNumber(),
                String.format("GRN %s processed for supplier '%s'. Total: %s",
                        grn.getGrnNumber(), grn.getSupplier().getName(), grn.getTotalAmount())
        );

        log.info("GRN '{}' processed successfully. Total: {}", grn.getGrnNumber(), grn.getTotalAmount());
        return GrnDto.from(updated);
    }
}
