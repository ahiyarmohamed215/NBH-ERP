package com.nbh.erp.gtn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.gtn.dto.CreateGtnRequest;
import com.nbh.erp.gtn.dto.GtnDto;
import com.nbh.erp.gtn.entity.Gtn;
import com.nbh.erp.gtn.entity.GtnItem;
import com.nbh.erp.gtn.repository.GtnRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class GtnService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final GtnRepository gtnRepository;
    private final com.nbh.erp.audit.service.AuditLogService audit;
    private final com.nbh.erp.user.repository.UserRepository staff;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

    @Transactional(readOnly = true)
    public PagedResponse<GtnDto> searchGtns(
            Long sourceWarehouseId,
            Long destinationWarehouseId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<GtnDto> page = gtnRepository.searchGtns(sourceWarehouseId, destinationWarehouseId, status, query, pageable)
                .map(GtnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public GtnDto getGtnById(Long id) {
        Gtn gtn = gtnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        return GtnDto.from(gtn);
    }

    public record ResponsibleStaff(Long id, String fullName, String username, String employeeCode, String phone, java.util.List<String> roles) {}

    @Transactional(readOnly = true)
    public java.util.List<ResponsibleStaff> getResponsibleStaff() {
        return staff.findAll(org.springframework.data.domain.Sort.by("fullName")).stream()
                .map(user -> new ResponsibleStaff(user.getId(), user.getFullName(), user.getUsername(), user.getEmployeeCode(), user.getPhone(),
                        user.getRoles().stream().map(role -> role.getName()).sorted().toList())).toList();
    }

    @Transactional
    public GtnDto createGtn(CreateGtnRequest request, boolean submitPending) {
        var ticket = idempotency.reserve("createGtn", request.toString() + "|" + submitPending);
        if (ticket != null && ticket.getResourceId() != null) return getGtnById(ticket.getResourceId());
        Gtn gtn = Gtn.builder().gtnNumber(sequenceService.generateGtnNumber()).items(new ArrayList<>()).build();
        applyRequest(gtn, request, submitPending);
        Gtn saved = gtnRepository.save(gtn);
        return idempotency.complete(ticket, saved.getId(), GtnDto.from(saved));
    }

    @Transactional
    public GtnDto updateGtn(Long id, CreateGtnRequest request) {
        var gtn = gtnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        boolean transferred = "TRANSFERRED".equals(gtn.getStatus());
        String previousStatus=gtn.getStatus();
        String requestedStatus=request.getStatus()!=null ? request.getStatus() : previousStatus;
        String statusReason=!previousStatus.equals(requestedStatus) ? com.nbh.erp.common.dto.StatusChangeRequest.requireReason(request.getStatusReason()) : null;
        if (!java.util.Set.of("DRAFT", "PENDING", "TRANSFERRED").contains(gtn.getStatus())) throw new BusinessException("Cancelled GTNs cannot be edited");
        if (transferred && request.getStatus() != null && !"TRANSFERRED".equals(request.getStatus())) throw new BusinessException("Use status actions to change a transferred GTN's status");
        var before = transferred ? transferEffects(gtn) : new java.util.TreeMap<StockKey, java.math.BigDecimal>();
        var confirmedDate = gtn.getReceiveDate();
        applyRequest(gtn, request, false);
        if (transferred) {
            applyTransferEdit(gtn, before);
            gtn.setStatus("TRANSFERRED"); gtn.setReceiveDate(confirmedDate);
        }
        audit.log("GTN_EDIT", "Gtn", gtn.getGtnNumber(), "Updated transfer details");
        if(!previousStatus.equals(gtn.getStatus())) {
            gtn.setLastStatusReason(statusReason);
            audit.log("GTN_STATUS", "PURCHASING", "Gtn", gtn.getGtnNumber(), previousStatus+" -> "+gtn.getStatus()+": "+statusReason);
        }
        return GtnDto.from(gtnRepository.save(gtn));
    }

    private void assignStaff(Gtn gtn, Long staffId) {
        if (staffId == null) { gtn.setResponsibleStaff(null); return; }
        var user = staff.findById(staffId).orElseThrow(() -> new BusinessException("Unknown responsible staff member"));
        gtn.setResponsibleStaff(user);
    }

    private void applyRequest(Gtn gtn, CreateGtnRequest request, boolean submitPending) {
        String status = submitPending ? "PENDING" : request.getStatus() == null ? gtn.getStatus() : request.getStatus();
        if (!java.util.Set.of("DRAFT", "PENDING").contains(status) && !("TRANSFERRED".equals(status) && "TRANSFERRED".equals(gtn.getStatus()))) throw new BusinessException("New GTNs must be draft or pending");
        assignStaff(gtn, request.getResponsibleStaffId());
        if ("PENDING".equals(status) && gtn.getResponsibleStaff() == null) throw new BusinessException("Assign responsible staff before creating a pending GTN");
        gtn.setStatus(status);
        gtn.setDispatchDate(request.getDispatchDate() == null ? LocalDate.now() : request.getDispatchDate());
        gtn.setNotes(request.getNotes()); gtn.getItems().clear();
        for (var line : request.getItems()) {
            var product = productRepository.findById(line.getProductId()).orElseThrow(() -> new BusinessException("Unknown product"));
            Long sourceId = line.getSourceWarehouseId() != null ? line.getSourceWarehouseId() : request.getSourceWarehouseId() != null ? request.getSourceWarehouseId() : product.getDefaultWarehouse() == null ? null : product.getDefaultWarehouse().getId();
            Long destinationId = line.getDestinationWarehouseId() != null ? line.getDestinationWarehouseId() : request.getDestinationWarehouseId();
            if (sourceId == null || destinationId == null) throw new BusinessException("Each GTN item needs a source and destination warehouse");
            if (sourceId.equals(destinationId)) throw new BusinessException("Source and destination cannot be the same for " + product.getName());
            var source = warehouseRepository.findById(sourceId).orElseThrow(() -> new BusinessException("Unknown source warehouse"));
            var destination = warehouseRepository.findById(destinationId).orElseThrow(() -> new BusinessException("Unknown destination warehouse"));
            if (!Boolean.TRUE.equals(source.getIsActive()) || !Boolean.TRUE.equals(destination.getIsActive())) throw new BusinessException("Line warehouses must be active");
            // Keep first-line headers for older integrations; inventory always uses the saved item routes.
            if (gtn.getItems().isEmpty()) { gtn.setSourceWarehouse(source); gtn.setDestinationWarehouse(destination); }
            gtn.getItems().add(GtnItem.builder().gtn(gtn).product(product).sourceWarehouse(source).destinationWarehouse(destination).quantityTransferred(line.getQuantityTransferred())
                    .unitCost(product.getCostPrice()).notes(line.getNotes()).build());
        }
    }

    @Transactional
    public GtnDto dispatchGtn(Long id, Long responsibleStaffId) {
        var gtn = gtnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        if (!java.util.Set.of("DRAFT", "PENDING", "CANCELLED").contains(gtn.getStatus())) throw new BusinessException("Completed GTNs cannot be dispatched again");
        if (responsibleStaffId != null) assignStaff(gtn, responsibleStaffId);
        if (gtn.getResponsibleStaff() == null) throw new BusinessException("Assign responsible staff before dispatch");
        assignStaff(gtn, gtn.getResponsibleStaff().getId());
        if (!"PENDING".equals(gtn.getStatus())) gtn.setDispatchDate(LocalDate.now());
        gtn.setStatus("PENDING");
        return GtnDto.from(gtnRepository.save(gtn));
    }

    @Transactional
    public GtnDto transferGtn(Long id) {
        Gtn gtn = gtnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        return executeTransfer(gtn);
    }

    private GtnDto executeTransfer(Gtn gtn) {
        if (!"PENDING".equals(gtn.getStatus())) {
            throw new BusinessException("Only pending GTNs can be marked transferred after the signed copy is received");
        }
        if (gtn.getResponsibleStaff() == null) throw new BusinessException("Assign responsible staff before completing the transfer");
        moveTransferStock(gtn, false);

        gtn.setStatus("TRANSFERRED");
        gtn.setReceiveDate(LocalDate.now());
        Gtn saved = gtnRepository.save(gtn);

        log.info("GTN '{}' executed successfully across {} saved item routes", gtn.getGtnNumber(), gtn.getItems().size());
        return GtnDto.from(saved);
    }

    @Transactional
    public GtnDto cancelGtn(Long id) {
        Gtn gtn = gtnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        if ("CANCELLED".equals(gtn.getStatus())) return GtnDto.from(gtn);
        if (java.util.Set.of("RECEIVED", "TRANSFERRED", "COMPLETED").contains(gtn.getStatus())) {
            moveTransferStock(gtn, true);
        } else if (!java.util.Set.of("DRAFT", "PENDING").contains(gtn.getStatus())) {
            throw new BusinessException("Cannot cancel GTN in its current status");
        }
        gtn.setStatus("CANCELLED");
        gtn.setReceiveDate(null);
        return GtnDto.from(gtnRepository.save(gtn));
    }

    @Transactional
    public GtnDto changeStatus(Long id, String target, String reason, boolean signedCopyReceived) {
        if (reason == null || reason.isBlank()) throw new BusinessException("Enter a reason for changing the GTN status");
        if (reason.trim().length() > 1000) throw new BusinessException("Status reason must be 1000 characters or fewer");
        if (!java.util.Set.of("PENDING", "TRANSFERRED", "CANCELLED").contains(target)) throw new BusinessException("Invalid GTN status");
        var gtn = gtnRepository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        String previous = "RECEIVED".equals(gtn.getStatus()) ? "TRANSFERRED" : gtn.getStatus();
        if (previous.equals(target)) return GtnDto.from(gtn);
        if (!java.util.Set.of("DRAFT", "PENDING", "TRANSFERRED", "CANCELLED").contains(previous)) throw new BusinessException("Invalid GTN transition");
        if ("TRANSFERRED".equals(target)) {
            if ("DRAFT".equals(previous)) throw new BusinessException("Send this draft GTN to pending before confirming transfer");
            if (!signedCopyReceived) throw new BusinessException("Confirm the signed copy was returned and all products were received");
            if (gtn.getResponsibleStaff() == null) throw new BusinessException("Edit the pending GTN to assign responsible staff before confirming transfer");
            moveTransferStock(gtn, false);
            gtn.setReceiveDate(LocalDate.now());
        } else {
            if ("TRANSFERRED".equals(previous)) moveTransferStock(gtn, true);
            gtn.setReceiveDate(null);
        }
        gtn.setStatus(target); gtn.setLastStatusReason(reason.trim());
        audit.log("GTN_STATUS", "Gtn", gtn.getGtnNumber(), previous + " -> " + target + ": " + reason.trim());
        return GtnDto.from(gtnRepository.save(gtn));
    }

    private record StockKey(Long warehouseId, Long productId) implements Comparable<StockKey> {
        public int compareTo(StockKey other) { int result = warehouseId.compareTo(other.warehouseId); return result == 0 ? productId.compareTo(other.productId) : result; }
    }
    private java.util.TreeMap<StockKey, java.math.BigDecimal> transferEffects(Gtn gtn) {
        var effects = new java.util.TreeMap<StockKey, java.math.BigDecimal>();
        for (var item : gtn.getItems()) {
            effects.merge(new StockKey(item.getTransferSource().getId(), item.getProduct().getId()), item.getQuantityTransferred().negate(), java.math.BigDecimal::add);
            effects.merge(new StockKey(item.getTransferDestination().getId(), item.getProduct().getId()), item.getQuantityTransferred(), java.math.BigDecimal::add);
        }
        return effects;
    }
    private void applyTransferEdit(Gtn gtn, java.util.TreeMap<StockKey, java.math.BigDecimal> before) {
        var after = transferEffects(gtn);
        var keys = new java.util.TreeSet<StockKey>(before.keySet()); keys.addAll(after.keySet());
        var deltas = new java.util.TreeMap<StockKey, java.math.BigDecimal>();
        for (var key : keys) {
            var delta = after.getOrDefault(key, java.math.BigDecimal.ZERO).subtract(before.getOrDefault(key, java.math.BigDecimal.ZERO));
            if (delta.signum() == 0) continue;
            var available = stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
            if (delta.signum() < 0 && available.compareTo(delta.negate()) < 0) throw new BusinessException("Cannot edit GTN: insufficient inventory for product " + key.productId() + ". Required: " + delta.negate() + "; available: " + available);
            deltas.put(key, delta);
        }
        for (var entry : deltas.entrySet()) {
            var key = entry.getKey(); var delta = entry.getValue();
            if (delta.signum() < 0) stockService.decreaseStock(key.warehouseId(), key.productId(), delta.negate(), "GTN_EDIT_OUT", gtn.getGtnNumber(), "Transfer edited");
            else {
                var product = productRepository.findById(key.productId()).orElseThrow(() -> new BusinessException("Unknown product"));
                stockService.increaseStock(key.warehouseId(), key.productId(), delta, product.getCostPrice(), "GTN_EDIT_IN", gtn.getGtnNumber(), "Transfer edited");
            }
        }
    }

    private record RouteKey(Long source, Long destination, Long product) implements Comparable<RouteKey> {
        public int compareTo(RouteKey other) { int result=source.compareTo(other.source); if(result==0) result=destination.compareTo(other.destination); return result==0 ? product.compareTo(other.product) : result; }
    }
    private void moveTransferStock(Gtn gtn, boolean reverse) {
        var routes = new java.util.TreeMap<RouteKey, java.math.BigDecimal>();
        var outgoing = new java.util.TreeMap<StockKey, java.math.BigDecimal>();
        var keys = new java.util.TreeSet<StockKey>();
        for (var item : gtn.getItems()) {
            Long source = (reverse ? item.getTransferDestination() : item.getTransferSource()).getId();
            Long destination = (reverse ? item.getTransferSource() : item.getTransferDestination()).getId();
            var route = new RouteKey(source, destination, item.getProduct().getId());
            routes.merge(route, item.getQuantityTransferred(), java.math.BigDecimal::add);
            var sourceKey = new StockKey(source, route.product());
            outgoing.merge(sourceKey, item.getQuantityTransferred(), java.math.BigDecimal::add);
            keys.add(sourceKey); keys.add(new StockKey(destination, route.product()));
        }
        // Validate all source deductions before changing any stock, including duplicate product lines.
        for (var key : keys) {
            var available = stockService.getAvailableStockForUpdate(key.warehouseId(), key.productId());
            var required = outgoing.getOrDefault(key, java.math.BigDecimal.ZERO);
            if (available.compareTo(required) < 0) throw new BusinessException("Cannot " + (reverse ? "reverse" : "process") + " GTN " + gtn.getGtnNumber()
                    + ": insufficient inventory for product " + key.productId() + " in warehouse " + key.warehouseId() + ". Required: " + required + "; available: " + available);
        }
        for (var entry : routes.entrySet()) {
            var route = entry.getKey();
            stockService.transferStock(route.source(), route.destination(), route.product(), entry.getValue(), gtn.getGtnNumber(),
                    reverse ? "GTN reversal: returned to the original line source" : "GTN line transfer");
        }
    }
}
