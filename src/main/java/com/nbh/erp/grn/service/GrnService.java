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
        setItems(grn, buildItems(grn, request));
    }

    private java.util.List<GrnItem> buildItems(Grn grn, CreateGrnRequest request) {
        var destinations = savedDestinations(grn);
        if(request.getPurchaseOrderId()!=null) purchaseOrders.deliveryWarehouses(request.getPurchaseOrderId(),request.getSupplierId()).forEach(destinations::putIfAbsent);
        var merged = new java.util.LinkedHashMap<Long, GrnItem>();
        for (var incoming : request.getItems()) {
            Product product = productRepository.findById(incoming.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", incoming.getProductId()));
            BigDecimal value = incoming.getQuantityReceived().multiply(incoming.getUnitCost());
            GrnItem line = merged.get(product.getId());
            if (line == null) {
                line = GrnItem.builder().grn(grn).product(product).warehouse(destinations.getOrDefault(product.getId(), product.getDefaultWarehouse()))
                        .quantityReceived(incoming.getQuantityReceived()).unitCost(incoming.getUnitCost())
                        .totalCost(value).notes(incoming.getNotes()).build();
                merged.put(product.getId(), line);
            } else {
                line.setQuantityReceived(line.getQuantityReceived().add(incoming.getQuantityReceived()));
                line.setTotalCost(line.getTotalCost().add(value));
                line.setUnitCost(line.getTotalCost().divide(line.getQuantityReceived(), 8, java.math.RoundingMode.HALF_UP));
                if (incoming.getNotes() != null) line.setNotes(incoming.getNotes());
            }
            line.setUseBrandMarkup(incoming.getUseBrandMarkup());
            if (Boolean.TRUE.equals(incoming.getUseBrandMarkup())) {
                BigDecimal markup = product.getBrand() != null ? product.getBrand().getMarkupPercent() : BigDecimal.ZERO;
                line.setMarkupPercent(markup);
                line.setSellingPrice(line.getUnitCost().multiply(BigDecimal.ONE.add(markup.movePointLeft(2)))
                        .setScale(2, java.math.RoundingMode.HALF_UP));
            } else {
                line.setSellingPrice(incoming.getSellingPrice());
                line.setMarkupPercent(incoming.getSellingPrice() == null ? incoming.getMarkupPercent()
                        : line.getUnitCost().signum() == 0 ? BigDecimal.ZERO
                        : incoming.getSellingPrice().subtract(line.getUnitCost()).multiply(new BigDecimal("100"))
                            .divide(line.getUnitCost(), 2, java.math.RoundingMode.HALF_UP));
            }
        }
        return new ArrayList<>(merged.values());
    }

    private void setItems(Grn grn, java.util.List<GrnItem> items) {
        grn.getItems().clear();
        grn.getItems().addAll(items);
        grn.setTotalAmount(items.stream().map(GrnItem::getTotalCost).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private java.util.Map<Long, Warehouse> savedDestinations(Grn grn) {
        var destinations = new java.util.HashMap<Long, Warehouse>();
        grn.getItems().forEach(item -> destinations.put(item.getProduct().getId(), item.getReceivingWarehouse()));
        return destinations;
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
        return resolveWarehouse(request, java.util.Map.of());
    }

    private Warehouse resolveWarehouse(CreateGrnRequest request, java.util.Map<Long, Warehouse> destinations) {
        Warehouse warehouse = null;
        var orderedDestinations=request.getPurchaseOrderId()!=null ? purchaseOrders.deliveryWarehouses(request.getPurchaseOrderId(),request.getSupplierId()) : java.util.Map.<Long,Warehouse>of();
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException("GRN must have at least one line item");
        }
        for (var item : request.getItems()) {
            Product product = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", item.getProductId()));
            if(request.getPurchaseOrderId()!=null && !orderedDestinations.containsKey(product.getId())) throw new BusinessException("Product not ordered: "+product.getSku());
            Warehouse destination = destinations.getOrDefault(product.getId(),orderedDestinations.getOrDefault(product.getId(),product.getDefaultWarehouse()));
            if (!Boolean.TRUE.equals(product.getIsActive())) throw new BusinessException("Product is inactive: " + product.getSku());
            if (destination == null || !Boolean.TRUE.equals(destination.getIsActive())) {
                throw new BusinessException("Set an active default warehouse on product " + product.getSku() + " before receiving goods");
            }
            if (request.getWarehouseId() != null && !request.getWarehouseId().equals(destination.getId())) {
                throw new BusinessException("Warehouse must match the selected products' default warehouse");
            }
            // Retain the header destination for compatibility; inventory uses each line's destination.
            if (warehouse == null) warehouse = destination;
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
        String previousStatus = grn.getStatus();
        String statusReason = autoProcess && !"PROCESSED".equals(previousStatus)
                ? com.nbh.erp.common.dto.StatusChangeRequest.requireReason(request.getStatusReason()) : null;

        if (!java.util.Set.of("DRAFT", "PROCESSED", "CANCELLED").contains(grn.getStatus())) {
            throw new BusinessException("Cannot edit GRN " + grn.getGrnNumber() + " with status " + grn.getStatus());
        }

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = resolveWarehouse(request, savedDestinations(grn));
        var updatedItems = buildItems(grn, request);
        boolean wasProcessed = "PROCESSED".equals(grn.getStatus());
        if (wasProcessed) {
            ensureNoDependentTransactions(grn, "editing");
            applyProcessedEdit(grn, updatedItems);
            updateOrderReceipt(grn, true);
        }

        grn.setPurchaseOrderId(request.getPurchaseOrderId());
        grn.setGrnType(resolveGrnType(request.getGrnType()));
        grn.setSupplier(supplier);
        grn.setWarehouse(warehouse);
        grn.setSupplierInvoiceNumber(request.getSupplierInvoiceNumber());
        grn.setReceivedDate(request.getReceivedDate());
        grn.setNotes(request.getNotes());

        setItems(grn, updatedItems);
        if (wasProcessed) updateOrderReceipt(grn, false);
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

        if (autoProcess && !wasProcessed) {
            var result = processGrnInternal(savedGrn);
            auditLogService.log("GRN_STATUS", "PURCHASING", "Grn", savedGrn.getGrnNumber(), previousStatus + " -> PROCESSED: " + statusReason);
            return result;
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
    public GrnDto processGrn(Long id, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        var grn = grnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        String previous = grn.getStatus();
        var result = processGrnInternal(grn);
        auditLogService.log("GRN_STATUS", "PURCHASING", "Grn", grn.getGrnNumber(), previous + " -> PROCESSED: " + reason);
        return result;
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
        com.nbh.erp.common.dto.StatusChangeRequest.requireReason(trimmedReason);
        String previousStatus = grn.getStatus();

        // If the GRN was PROCESSED, reverse inventory
        if ("PROCESSED".equals(grn.getStatus())) {
            ensureNoDependentTransactions(grn, "cancelling");
            var receivedStock = receiptStock(grn.getItems());
            // Lock and validate every original destination before any stock is reversed.
            for (var entry : receivedStock.entrySet()) {
                var key = entry.getKey();
                var item = entry.getValue();
                BigDecimal available = stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
                if (available.compareTo(item.quantity()) < 0) {
                    throw new BusinessException(String.format(
                            "Cannot cancel GRN %s: insufficient inventory for '%s' (%s). Need to deduct %s; available stock is %s.",
                            grn.getGrnNumber(),
                            item.product().getName(),
                            item.product().getSku(),
                            item.quantity(),
                            available
                    ));
                }
            }

            // Second pass: Reverse stock for all line items
            for (var entry : receivedStock.entrySet()) {
                var key = entry.getKey();
                var item = entry.getValue();
                stockService.decreaseStock(
                        key.warehouseId(),
                        key.productId(),
                        item.quantity(),
                        item.unitCost(),
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
                previousStatus + " -> CANCELLED: " + trimmedReason
        );

        log.info("GRN '{}' cancelled successfully by '{}'. Reason: {}", grn.getGrnNumber(), currentUsername, trimmedReason);

        return GrnDto.from(saved);
    }

    private GrnDto processGrnInternal(Grn grn) {
        boolean restoring = "CANCELLED".equals(grn.getStatus());
        if (!"DRAFT".equals(grn.getStatus()) && !restoring) {
            throw new BusinessException("Only draft or cancelled GRNs can be processed. GRN " + grn.getGrnNumber() + " is " + grn.getStatus());
        }

        for (GrnItem item : grn.getItems()) {
            if (!Boolean.TRUE.equals(item.getReceivingWarehouse().getIsActive())) {
                throw new BusinessException("Receiving destination is inactive for product " + item.getProduct().getSku());
            }
            stockService.increaseStock(
                    item.getReceivingWarehouse().getId(),
                    item.getProduct().getId(),
                    item.getQuantityReceived(),
                    item.getUnitCost(),
                    "GRN",
                    grn.getGrnNumber(),
                    "Supplier: " + grn.getSupplier().getName() + " (Inv: " + grn.getSupplierInvoiceNumber() + ")"
            );
        }

        publishProductPrices(grn.getItems());
        updateOrderReceipt(grn,false);
        grn.setStatus("PROCESSED");
        if (restoring) {
            grn.setCancelledAt(null);
            grn.setCancelledBy(null);
            grn.setCancelReason(null);
        }
        Grn updated = grnRepository.save(grn);

        auditLogService.log(
                restoring ? "GRN_RESTORE" : "GRN_PROCESS",
                "Grn",
                grn.getGrnNumber(),
                String.format("GRN %s processed for supplier '%s'. Total: %s",
                        grn.getGrnNumber(), grn.getSupplier().getName(), grn.getTotalAmount())
        );

        log.info("GRN '{}' processed successfully. Total: {}", grn.getGrnNumber(), grn.getTotalAmount());
        return GrnDto.from(updated);
    }
    private record StockKey(Long warehouseId, Long productId) implements Comparable<StockKey> {
        public int compareTo(StockKey other) {
            int destination = warehouseId.compareTo(other.warehouseId);
            return destination != 0 ? destination : productId.compareTo(other.productId);
        }
    }

    private record ReceiptStock(Product product, Warehouse warehouse, BigDecimal quantity, BigDecimal value) {
        BigDecimal unitCost() { return value.divide(quantity, 8, java.math.RoundingMode.HALF_UP); }
    }

    private java.util.SortedMap<StockKey, ReceiptStock> receiptStock(java.util.List<GrnItem> items) {
        var stock = new java.util.TreeMap<StockKey, ReceiptStock>();
        for (var item : items) {
            var destination = item.getReceivingWarehouse();
            var key = new StockKey(destination.getId(), item.getProduct().getId());
            var entry = new ReceiptStock(item.getProduct(), destination, item.getQuantityReceived(), item.getTotalCost());
            stock.merge(key, entry, (old, added) -> new ReceiptStock(old.product(), old.warehouse(),
                    old.quantity().add(added.quantity()), old.value().add(added.value())));
        }
        return stock;
    }

    private void ensureNoDependentTransactions(Grn grn, String action) {
        if (purchaseReturns.totalReturned(grn.getId()).signum() > 0 || supplierPayments.totalPaid(grn.getId()).signum() > 0) {
            throw new BusinessException("Reverse dependent supplier payments/returns before " + action + " this receipt");
        }
    }

    private void applyProcessedEdit(Grn grn, java.util.List<GrnItem> updatedItems) {
        var original = receiptStock(grn.getItems());
        var updated = receiptStock(updatedItems);
        var keys = new java.util.TreeSet<StockKey>(original.keySet());
        keys.addAll(updated.keySet());
        // Lock in destination/product order and check all reductions before changing stock.
        for (var key : keys) {
            BigDecimal before = original.containsKey(key) ? original.get(key).quantity() : BigDecimal.ZERO;
            BigDecimal after = updated.containsKey(key) ? updated.get(key).quantity() : BigDecimal.ZERO;
            BigDecimal available = stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
            BigDecimal reduction = before.subtract(after);
            if (reduction.signum() > 0 && available.compareTo(reduction) < 0) {
                throw new BusinessException(String.format("Cannot edit GRN %s: insufficient inventory for '%s' (%s). Need to deduct %s; available stock is %s.",
                        grn.getGrnNumber(), original.get(key).product().getName(), original.get(key).product().getSku(), reduction, available));
            }
        }
        for (var key : keys) {
            BigDecimal before = original.containsKey(key) ? original.get(key).quantity() : BigDecimal.ZERO;
            BigDecimal after = updated.containsKey(key) ? updated.get(key).quantity() : BigDecimal.ZERO;
            BigDecimal change = after.subtract(before);
            if (change.signum() < 0) {
                stockService.decreaseStock(key.warehouseId(), key.productId(), change.negate(), original.get(key).unitCost(),
                        "GRN_EDIT", grn.getGrnNumber(), "Quantity reduced by GRN edit");
            } else if (change.signum() > 0) {
                stockService.increaseStock(key.warehouseId(), key.productId(), change, updated.get(key).unitCost(),
                        "GRN", grn.getGrnNumber(), "Quantity added by GRN edit");
            }
            if (updated.containsKey(key) && updated.get(key).unitCost().signum() > 0) {
                updated.get(key).product().setCostPrice(updated.get(key).unitCost());
                productRepository.save(updated.get(key).product());
            }
        }
        publishProductPrices(updatedItems);
    }

    private void publishProductPrices(java.util.List<GrnItem> items) {
        for (var item : items) {
            var product = item.getProduct();
            if (Boolean.TRUE.equals(item.getUseBrandMarkup())) product.setUseBrandMarkup(true);
            else if (item.getSellingPrice() != null) product.setUseBrandMarkup(false);
            if (item.getSellingPrice() != null) product.setSellingPrice(item.getSellingPrice());
            productRepository.save(product);
        }
    }

    private void updateOrderReceipt(Grn grn,boolean reverse) {
        if(grn.getPurchaseOrderId()==null) return;
        java.util.Map<Long,java.util.Map<Long,BigDecimal>> destinations=new java.util.TreeMap<>();
        grn.getItems().forEach(i -> destinations.computeIfAbsent(i.getReceivingWarehouse().getId(),key->new java.util.TreeMap<>()).merge(i.getProduct().getId(),i.getQuantityReceived(),BigDecimal::add));
        for(var destination:destinations.entrySet()) purchaseOrders.receive(grn.getPurchaseOrderId(),grn.getSupplier().getId(),destination.getKey(),destination.getValue(),reverse);
    }
}
