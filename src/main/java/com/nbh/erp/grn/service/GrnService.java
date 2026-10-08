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
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final GrnRepository grnRepository;
    private final com.nbh.erp.purchaseorder.service.PurchaseOrderService purchaseOrders;
    private final com.nbh.erp.purchasereturn.repository.PurchaseReturnRepository purchaseReturns;
    private final com.nbh.erp.payment.repository.SupplierPaymentRepository supplierPayments;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;

    private void replaceItems(Grn grn, CreateGrnRequest request) {
        var merged = new java.util.LinkedHashMap<Long, GrnItem>();
        for (var incoming : request.getItems()) {
            Product product = productRepository.findById(incoming.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", incoming.getProductId()));
            BigDecimal value = incoming.getQuantityReceived().multiply(incoming.getUnitCost());
            GrnItem line = merged.get(product.getId());
            if (line == null) {
                line = GrnItem.builder().grn(grn).product(product)
                        .quantityReceived(incoming.getQuantityReceived()).unitCost(incoming.getUnitCost())
                        .totalCost(value).notes(incoming.getNotes()).build();
                merged.put(product.getId(), line);
            } else {
                line.setQuantityReceived(line.getQuantityReceived().add(incoming.getQuantityReceived()));
                line.setTotalCost(line.getTotalCost().add(value));
                line.setUnitCost(line.getTotalCost().divide(line.getQuantityReceived(), 8, java.math.RoundingMode.HALF_UP));
                if (incoming.getNotes() != null) line.setNotes(incoming.getNotes());
            }
        }
        grn.getItems().clear();
        grn.getItems().addAll(merged.values());
        grn.setTotalAmount(merged.values().stream().map(GrnItem::getTotalCost).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private String resolveGrnType(String type) {
        if (type == null || type.isBlank()) return "Standard Inward";
        if (!java.util.Set.of("Standard Inward", "Import Shipment", "Direct Purchase",
                "Consignment Intake", "Inter-Branch Transfer In", "Sample / Promotional").contains(type)) {
            throw new BusinessException("Invalid GRN type");
        }
        return type;
    }

    private Warehouse resolveWarehouse(CreateGrnRequest request) {
        Warehouse warehouse = null;
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException("GRN must have at least one line item");
        }
        for (var item : request.getItems()) {
            Product product = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", item.getProductId()));
            Warehouse destination = product.getDefaultWarehouse();
            if (!Boolean.TRUE.equals(product.getIsActive())) throw new BusinessException("Product is inactive: " + product.getSku());
            if (destination == null || !Boolean.TRUE.equals(destination.getIsActive())) {
                throw new BusinessException("Set an active default warehouse on product " + product.getSku() + " before receiving goods");
            }
            if (warehouse != null && !warehouse.getId().equals(destination.getId())) {
                throw new BusinessException("Products belong to different warehouses. Create a separate GRN for each warehouse");
            }
            warehouse = destination;
        }
        if (request.getWarehouseId() != null && !request.getWarehouseId().equals(warehouse.getId())) {
            throw new BusinessException("Warehouse must match the selected products' default warehouse");
        }
        return warehouse;
    }

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
        var ticket=idempotency.reserve("createGrn",request.toString()+"|"+autoProcess);
        if(ticket!=null && ticket.getResourceId()!=null) return getGrnById(ticket.getResourceId());

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = resolveWarehouse(request);

        String grnNumber = sequenceService.generateGrnNumber();

        Grn grn = Grn.builder()
                .grnNumber(grnNumber)
                .grnType(resolveGrnType(request.getGrnType()))
                .purchaseOrderId(request.getPurchaseOrderId())
                .supplier(supplier)
                .warehouse(warehouse)
                .supplierInvoiceNumber(request.getSupplierInvoiceNumber())
                .receivedDate(request.getReceivedDate())
                .notes(request.getNotes())
                .status("DRAFT")
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        replaceItems(grn, request);
        Grn savedGrn = grnRepository.save(grn);

        if (autoProcess) {
            return idempotency.complete(ticket,savedGrn.getId(),processGrnInternal(savedGrn));
        }

        return idempotency.complete(ticket,savedGrn.getId(),GrnDto.from(savedGrn));
    }

    @Transactional
    public GrnDto updateGrn(Long id, CreateGrnRequest request, boolean autoProcess) {
        Grn grn = grnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));

        SecurityUtils.enforceCanEdit("GRN", grn.getGrnNumber());

        if (!"DRAFT".equals(grn.getStatus())) {
            throw new BusinessException("Only DRAFT GRNs can be edited. GRN " + grn.getGrnNumber() + " is " + grn.getStatus());
        }

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = resolveWarehouse(request);

        grn.setPurchaseOrderId(request.getPurchaseOrderId());
        grn.setGrnType(resolveGrnType(request.getGrnType()));
        grn.setSupplier(supplier);
        grn.setWarehouse(warehouse);
        grn.setSupplierInvoiceNumber(request.getSupplierInvoiceNumber());
        grn.setReceivedDate(request.getReceivedDate());
        grn.setNotes(request.getNotes());

        replaceItems(grn, request);
        Grn savedGrn = grnRepository.save(grn);

        auditLogService.log(
                "GRN_UPDATE",
                "Grn",
                savedGrn.getGrnNumber(),
                String.format("GRN %s updated for supplier '%s' by %s. Total: %s",
                        savedGrn.getGrnNumber(),
                        savedGrn.getSupplier().getName(),
                        SecurityUtils.getCurrentUsername().orElse("SYSTEM"),
                        savedGrn.getTotalAmount())
        );

        if (autoProcess) {
            return processGrnInternal(savedGrn);
        }

        return GrnDto.from(savedGrn);
    }

    @Transactional
    public void deleteGrn(Long id) {
        SecurityUtils.enforceNoDelete("GRN", id);
    }

    @Transactional
    public GrnDto processGrn(Long id) {
        Grn grn = grnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        return processGrnInternal(grn);
    }

    @Transactional
    public GrnDto cancelGrn(Long id, String reason) {
        Grn grn = grnRepository.findByIdForUpdate(id)
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
            if(purchaseReturns.totalReturned(grn.getId()).signum()>0 || supplierPayments.totalPaid(grn.getId()).signum()>0) throw new BusinessException("Reverse dependent supplier payments/returns before cancelling this receipt");
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
                        item.getUnitCost(),
                        "GRN_CANCEL",
                        grn.getGrnNumber(),
                        "Cancellation of GRN " + grn.getGrnNumber() + " - Reason: " + trimmedReason
                );
            }
        }

        String currentUsername = SecurityUtils.getCurrentUsername().orElse("SYSTEM");

        if("PROCESSED".equals(grn.getStatus())) updateOrderReceipt(grn,true);
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

        updateOrderReceipt(grn,false);
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
    private void updateOrderReceipt(Grn grn,boolean reverse) {
        if(grn.getPurchaseOrderId()==null) return;
        java.util.Map<Long,BigDecimal> qty=new java.util.TreeMap<>();
        grn.getItems().forEach(i -> qty.merge(i.getProduct().getId(),i.getQuantityReceived(),BigDecimal::add));
        purchaseOrders.receive(grn.getPurchaseOrderId(),grn.getSupplier().getId(),grn.getWarehouse().getId(),qty,reverse);
    }
}
