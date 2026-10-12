package com.nbh.erp.purchasereturn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest;
import com.nbh.erp.purchasereturn.dto.PurchaseReturnDto;
import com.nbh.erp.purchasereturn.entity.PurchaseReturn;
import com.nbh.erp.purchasereturn.entity.PurchaseReturnItem;
import com.nbh.erp.purchasereturn.repository.PurchaseReturnRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PurchaseReturnService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;
    private final PurchaseReturnRepository purchaseReturnRepository;
    private final com.nbh.erp.grn.repository.GrnRepository receipts;
    private final com.nbh.erp.payment.repository.SupplierPaymentRepository supplierPayments;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final com.nbh.erp.inventory.repository.StockBalanceRepository balances;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final com.nbh.erp.audit.service.AuditLogService audit;

    private record StockKey(Long warehouseId, Long productId) implements Comparable<StockKey> {
        public int compareTo(StockKey other) {
            int result = warehouseId.compareTo(other.warehouseId);
            return result != 0 ? result : productId.compareTo(other.productId);
        }
    }
    private record ReceiptKey(Long grnId, Long warehouseId, Long productId) {}
    private record ReceiptProductKey(Long grnId, Long productId) {}
    public record ReturnSource(Long productId, String sku, String name, String barcode, Long sourceGrnId,
            String originalGrnNumber, Long supplierId, String supplierName, Long warehouseId,
            String warehouseName, BigDecimal costPrice, BigDecimal availableQuantity, BigDecimal returnableQuantity) {}

    @Transactional(readOnly = true)
    public List<ReturnSource> getReturnSources() {
        Map<StockKey, BigDecimal> available = new TreeMap<>();
        Map<Long, String> warehouseNames = new HashMap<>();
        for (var balance : balances.findAllWithProductAndWarehouse(null)) {
            if (balance.getAvailableQuantity().signum() > 0) {
                available.put(new StockKey(balance.getWarehouse().getId(), balance.getProduct().getId()), balance.getAvailableQuantity());
                warehouseNames.put(balance.getWarehouse().getId(), balance.getWarehouse().getName());
            }
        }
        List<ReturnSource> result = new ArrayList<>();
        for (var grn : receipts.findProcessedReturnReceipts()) {
            Map<Long, List<GrnItem>> groups = new LinkedHashMap<>();
            for (var line : grn.getItems()) groups.computeIfAbsent(line.getProduct().getId(), key -> new ArrayList<>()).add(line);
            for (var entry : groups.entrySet()) {
                var receiptLines = entry.getValue();
                var originalQuantity = receiptLines.stream().map(GrnItem::getQuantityReceived).reduce(BigDecimal.ZERO, BigDecimal::add);
                var remaining = originalQuantity.subtract(purchaseReturnRepository.returnedQuantity(grn.getId(), entry.getKey()));
                if (remaining.signum() <= 0) continue;
                var product = receiptLines.getFirst().getProduct();
                var receivingWarehouses = new HashSet<>(receiptLines.stream().map(line -> line.getReceivingWarehouse().getId()).toList());
                // Prefer the original receiving warehouse, but adjusted/transferred stock can be
                // returned from its current warehouse against this product's purchase history.
                var stocked = available.entrySet().stream().filter(stock -> stock.getKey().productId().equals(product.getId()))
                        .sorted(Comparator.comparing(stock -> !receivingWarehouses.contains(stock.getKey().warehouseId()))).toList();
                for (var stock : stocked) {
                    var key = stock.getKey();
                    result.add(new ReturnSource(product.getId(), product.getSku(), product.getName(), product.getBarcode(), grn.getId(), grn.getGrnNumber(),
                            grn.getSupplier().getId(), grn.getSupplier().getName(), key.warehouseId(), warehouseNames.get(key.warehouseId()),
                            receiptCost(receiptLines), stock.getValue(), remaining));
                }
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public PagedResponse<PurchaseReturnDto> searchPurchaseReturns(Long warehouseId, Long supplierId, String status, String query, Pageable pageable) {
        return PagedResponse.from(purchaseReturnRepository.searchPurchaseReturns(warehouseId, supplierId, status, query, pageable).map(PurchaseReturnDto::from));
    }

    @Transactional(readOnly = true)
    public PurchaseReturnDto getPurchaseReturnById(Long id) {
        return PurchaseReturnDto.from(purchaseReturnRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id)));
    }

    @Transactional
    public PurchaseReturnDto createPurchaseReturn(CreatePurchaseReturnRequest request, boolean autoProcess) {
        var ticket = idempotency.reserve("createPurchaseReturn", request.toString() + "|" + autoProcess);
        if (ticket != null && ticket.getResourceId() != null) return getPurchaseReturnById(ticket.getResourceId());
        var prn = PurchaseReturn.builder().prnNumber(sequenceService.generatePrnNumber()).status("DRAFT").items(new ArrayList<>()).build();
        applyRequest(prn, request);
        var saved = purchaseReturnRepository.saveAndFlush(prn);
        return idempotency.complete(ticket, saved.getId(), autoProcess ? processPurchaseReturnInternal(saved) : PurchaseReturnDto.from(saved));
    }

    @Transactional
    public PurchaseReturnDto updatePurchaseReturn(Long id, CreatePurchaseReturnRequest request, boolean autoProcess) {
        var prn = purchaseReturnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));
        if (!Set.of("DRAFT", "PENDING", "PROCESSED").contains(prn.getStatus())) throw new BusinessException("Cancelled PRNs cannot be edited");
        boolean processed = "PROCESSED".equals(prn.getStatus());
        String previousStatus = prn.getStatus();
        String statusReason = autoProcess && !processed ? com.nbh.erp.common.dto.StatusChangeRequest.requireReason(request.getStatusReason()) : null;
        if (processed) {
            if (request.getItems() == null || request.getItems().isEmpty()) throw new BusinessException("Add at least one return item");
            var receiptIds = new ArrayList<>(prn.getItems().stream().map(PurchaseReturnItem::getOriginalGrnId).toList());
            receiptIds.addAll(request.getItems().stream().map(item -> item.getSourceGrnId() != null ? item.getSourceGrnId() : request.getSourceGrnId()).toList());
            lockReceipts(receiptIds);
            var stockKeys = new TreeSet<>(stockQuantities(prn).keySet());
            for (var item : request.getItems()) {
                Long warehouseId = item.getWarehouseId() != null ? item.getWarehouseId() : request.getWarehouseId();
                if (warehouseId == null || item.getProductId() == null) throw new BusinessException("Each return item needs a product and stocked warehouse");
                stockKeys.add(new StockKey(warehouseId, item.getProductId()));
            }
            for (var key : stockKeys) stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
            var preview = PurchaseReturn.builder().status("DRAFT").items(new ArrayList<>()).build();
            applyRequest(preview, request);
            validateReturn(preview, prn);
            // Temporarily reverse the original return inside this transaction. Reprocessing validates the
            // replacement against restored stock and supplier balances; any failure rolls back every change.
            for (var item : sortedItems(prn)) stockService.increaseStock(item.getReturnWarehouse().getId(), item.getProduct().getId(),
                    item.getQuantityReturned(), item.getUnitCost(), "PRN_EDIT_RESTORE", prn.getPrnNumber(), "Restore original return before editing");
            prn.setStatus("DRAFT");
            purchaseReturnRepository.saveAndFlush(prn);
        }
        applyRequest(prn, request);
        purchaseReturnRepository.saveAndFlush(prn);
        var result = processed || autoProcess ? processPurchaseReturnInternal(prn) : PurchaseReturnDto.from(prn);
        if (!previousStatus.equals(result.getStatus())) audit.log("PRN_STATUS", "PURCHASING", "PurchaseReturn", prn.getPrnNumber(), previousStatus + " -> " + result.getStatus() + ": " + statusReason);
        return result;
    }

    private void applyRequest(PurchaseReturn prn, CreatePurchaseReturnRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) throw new BusinessException("Add at least one return item");
        Map<Long, Grn> originals = lockReceipts(request.getItems().stream().map(item -> item.getSourceGrnId() != null ? item.getSourceGrnId() : request.getSourceGrnId()).toList());
        List<PurchaseReturnItem> lines = new ArrayList<>();
        Set<ReceiptKey> seen = new HashSet<>();
        for (var input : request.getItems()) {
            var grn = originals.get(input.getSourceGrnId() != null ? input.getSourceGrnId() : request.getSourceGrnId());
            Long warehouseId = input.getWarehouseId() != null ? input.getWarehouseId() : request.getWarehouseId();
            if (warehouseId == null) throw new BusinessException("Select the stocked warehouse for each return item");
            if (!"PROCESSED".equals(grn.getStatus())) throw new BusinessException("Return must match a processed original GRN");
            if (input.getSourceGrnId() == null && request.getSupplierId() != null && !request.getSupplierId().equals(grn.getSupplier().getId())) throw new BusinessException("Return must match processed GRN supplier");
            var key = new ReceiptKey(grn.getId(), warehouseId, input.getProductId());
            if (!seen.add(key)) throw new BusinessException("Duplicate return product for the same GRN and warehouse");
            var receiptLines = receiptLines(grn, input.getProductId());
            if (input.getQuantityReturned() == null || input.getQuantityReturned().signum() <= 0) throw new BusinessException("Return quantity must be greater than zero");
            var product = productRepository.findById(input.getProductId()).orElseThrow(() -> new ResourceNotFoundException("Product", "id", input.getProductId()));
            var warehouse = warehouseRepository.findById(warehouseId).orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
            if (input.getReason() != null && input.getReason().length() > 255) throw new BusinessException("Item reason must be 255 characters or fewer");
            var cost = receiptCost(receiptLines);
            lines.add(PurchaseReturnItem.builder().purchaseReturn(prn).sourceGrn(grn).warehouse(warehouse).product(product)
                    .quantityReturned(input.getQuantityReturned()).unitCost(cost).totalCost(cost.multiply(input.getQuantityReturned()).setScale(2, RoundingMode.HALF_UP))
                    .reason(input.getReason() != null ? input.getReason() : request.getReason()).remarks(input.getRemarks()).build());
        }
        var first = lines.getFirst();
        // Legacy header fields remain populated; each line carries its authoritative receipt and warehouse.
        prn.setSourceGrnId(first.getOriginalGrnId());prn.setSupplier(first.getReturnSupplier());prn.setWarehouse(first.getReturnWarehouse());
        prn.setReturnDate(request.getReturnDate());prn.setReason(request.getReason());prn.setRemarks(request.getRemarks());
        prn.getItems().clear();prn.getItems().addAll(lines);
        prn.setTotalAmount(lines.stream().map(PurchaseReturnItem::getTotalCost).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private Map<Long, Grn> lockReceipts(List<Long> ids) {
        if (ids.stream().anyMatch(Objects::isNull)) throw new BusinessException("Link an original GRN for every return item");
        Map<Long, Grn> result = new TreeMap<>();
        for (Long id : new TreeSet<>(ids)) result.put(id, receipts.findByIdForUpdate(id).orElseThrow(() -> new BusinessException("Unknown original GRN")));
        return result;
    }
    private List<GrnItem> receiptLines(Grn grn, Long productId) {
        var lines = grn.getItems().stream().filter(line -> line.getProduct().getId().equals(productId)).toList();
        if (lines.isEmpty()) throw new BusinessException("Product must have been purchased in the original GRN");
        return lines;
    }
    private BigDecimal receiptCost(List<GrnItem> lines) {
        var quantity = lines.stream().map(GrnItem::getQuantityReceived).reduce(BigDecimal.ZERO, BigDecimal::add);
        return lines.stream().map(GrnItem::getTotalCost).reduce(BigDecimal.ZERO, BigDecimal::add).divide(quantity, 6, RoundingMode.HALF_UP);
    }
    private TreeMap<StockKey, BigDecimal> stockQuantities(PurchaseReturn prn) {
        var quantities = new TreeMap<StockKey, BigDecimal>();
        for (var item : prn.getItems()) quantities.merge(new StockKey(item.getReturnWarehouse().getId(), item.getProduct().getId()), item.getQuantityReturned(), BigDecimal::add);
        return quantities;
    }
    private List<PurchaseReturnItem> sortedItems(PurchaseReturn prn) {
        return prn.getItems().stream().sorted(Comparator.comparing((PurchaseReturnItem item) -> item.getReturnWarehouse().getId()).thenComparing(item -> item.getProduct().getId()).thenComparing(PurchaseReturnItem::getOriginalGrnId)).toList();
    }

    @Transactional
    public PurchaseReturnDto processPurchaseReturn(Long id) {
        return processPurchaseReturnInternal(purchaseReturnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id)));
    }
    @Transactional
    public PurchaseReturnDto processPurchaseReturn(Long id, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        String previous = purchaseReturnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id)).getStatus();
        var result = processPurchaseReturn(id);
        audit.log("PRN_STATUS", "PURCHASING", "PurchaseReturn", result.getPrnNumber(), previous + " -> " + result.getStatus() + ": " + reason);
        return result;
    }
    @Transactional
    public PurchaseReturnDto cancelPurchaseReturn(Long id, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        var document = purchaseReturnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));
        String previous = document.getStatus();
        var result = cancelPurchaseReturn(id);
        if (!previous.equals(result.getStatus())) audit.log("PRN_STATUS", "PURCHASING", "PurchaseReturn", result.getPrnNumber(), previous + " -> " + result.getStatus() + ": " + reason);
        return result;
    }
    private PurchaseReturnDto processPurchaseReturnInternal(PurchaseReturn prn) {
        if ("PROCESSED".equals(prn.getStatus())) throw new BusinessException("PRN " + prn.getPrnNumber() + " is already processed");
        if (!Set.of("DRAFT", "PENDING", "CANCELLED").contains(prn.getStatus())) throw new BusinessException("Cannot process PRN in its current status");
        var receiptTotals = validateReturn(prn, null);
        for (var item : sortedItems(prn)) stockService.decreaseStock(item.getReturnWarehouse().getId(), item.getProduct().getId(), item.getQuantityReturned(), item.getUnitCost(),
                "PRN", prn.getPrnNumber(), "Returned to supplier: " + item.getReturnSupplier().getName() + " (GRN: " + item.getOriginalGrnId() + ")");
        prn.setTotalAmount(receiptTotals.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));prn.setStatus("PROCESSED");
        return PurchaseReturnDto.from(purchaseReturnRepository.save(prn));
    }

    private Map<Long, BigDecimal> validateReturn(PurchaseReturn prn, PurchaseReturn original) {
        var originals = lockReceipts(prn.getItems().stream().map(PurchaseReturnItem::getOriginalGrnId).toList());
        Map<ReceiptProductKey, BigDecimal> originalQuantities = new HashMap<>();
        Map<Long, BigDecimal> originalTotals = new HashMap<>();
        if (original != null) for (var item : original.getItems()) {
            originalQuantities.merge(new ReceiptProductKey(item.getOriginalGrnId(), item.getProduct().getId()), item.getQuantityReturned(), BigDecimal::add);
            originalTotals.merge(item.getOriginalGrnId(), item.getTotalCost(), BigDecimal::add);
        }
        Map<ReceiptProductKey, BigDecimal> quantities = new HashMap<>();
        Map<Long, BigDecimal> receiptTotals = new TreeMap<>();
        for (var item : prn.getItems()) {
            var grn = originals.get(item.getOriginalGrnId());
            if (!"PROCESSED".equals(grn.getStatus()) || !grn.getSupplier().getId().equals(item.getReturnSupplier().getId())) throw new BusinessException("Return must match processed GRN supplier");
            var warehouseId = item.getReturnWarehouse().getId();
            var lines = receiptLines(grn, item.getProduct().getId());
            var key = new ReceiptProductKey(grn.getId(), item.getProduct().getId());
            quantities.merge(key, item.getQuantityReturned(), BigDecimal::add);
            var originalQty = lines.stream().map(GrnItem::getQuantityReceived).reduce(BigDecimal.ZERO, BigDecimal::add);
            var returned = purchaseReturnRepository.returnedQuantity(grn.getId(), item.getProduct().getId()).subtract(originalQuantities.getOrDefault(key, BigDecimal.ZERO));
            if (returned.add(quantities.get(key)).compareTo(originalQty) > 0) throw new BusinessException("Return exceeds original unreturned receipt");
            item.setUnitCost(receiptCost(lines));item.setTotalCost(item.getUnitCost().multiply(item.getQuantityReturned()).setScale(2, RoundingMode.HALF_UP));
            receiptTotals.merge(grn.getId(), item.getTotalCost(), BigDecimal::add);
        }
        for (var entry : receiptTotals.entrySet()) {
            var grn = originals.get(entry.getKey());
            if (entry.getValue().compareTo(grn.getTotalAmount().subtract(purchaseReturnRepository.totalReturned(grn.getId())).subtract(supplierPayments.totalPaid(grn.getId())).add(originalTotals.getOrDefault(grn.getId(), BigDecimal.ZERO))) > 0)
                throw new BusinessException("Reverse supplier payment before returning paid goods from " + grn.getGrnNumber());
        }
        var stockCredit = original != null ? stockQuantities(original) : new TreeMap<StockKey, BigDecimal>();
        for (var entry : stockQuantities(prn).entrySet()) {
            var available = stockService.getAvailableStockForUpdate(entry.getKey().warehouseId(), entry.getKey().productId()).add(stockCredit.getOrDefault(entry.getKey(), BigDecimal.ZERO));
            if (available.compareTo(entry.getValue()) < 0) throw new BusinessException("Cannot process PRN: insufficient inventory. Required: " + entry.getValue() + "; available: " + available);
        }
        return receiptTotals;
    }

    @Transactional
    public PurchaseReturnDto cancelPurchaseReturn(Long id) {
        var prn = purchaseReturnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));
        if ("CANCELLED".equals(prn.getStatus())) return PurchaseReturnDto.from(prn);
        if ("PROCESSED".equals(prn.getStatus())) {
            lockReceipts(prn.getItems().stream().map(PurchaseReturnItem::getOriginalGrnId).toList());
            for (var key : stockQuantities(prn).keySet()) stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
            for (var item : sortedItems(prn)) stockService.increaseStock(item.getReturnWarehouse().getId(), item.getProduct().getId(), item.getQuantityReturned(), item.getUnitCost(), "PRN_CANCEL", prn.getPrnNumber(), "Purchase return cancelled: stock restored");
        } else if (!Set.of("DRAFT", "PENDING").contains(prn.getStatus())) throw new BusinessException("Cannot cancel PRN in its current status");
        prn.setStatus("CANCELLED");
        return PurchaseReturnDto.from(purchaseReturnRepository.save(prn));
    }
}
