package com.nbh.erp.stockadjustment.service;

import com.nbh.erp.audit.service.AuditLogService;
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
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final StockAdjustmentRepository adjustmentRepository;
    private final com.nbh.erp.grn.repository.GrnItemRepository grnItems;
    private final com.nbh.erp.grn.repository.GrnRepository grns;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;

    public record AdjustmentProduct(Long productId,String productName,String productCode,Long warehouseId,
        String warehouseName,BigDecimal availableStock,Long sourceGrnId,String sourceGrnNumber,BigDecimal unitCost) {}

    @Transactional(readOnly=true)
    public java.util.List<AdjustmentProduct> searchProducts(String query) {
        return grnItems.searchAdjustmentProducts(query==null?"":query.trim(),org.springframework.data.domain.PageRequest.of(0,100)).stream()
            .map(line->new AdjustmentProduct(line.getProduct().getId(),line.getProduct().getName(),line.getProduct().getSku(),
                line.getReceivingWarehouse().getId(),line.getReceivingWarehouse().getName(),
                stockService.getAvailableStock(line.getReceivingWarehouse().getId(),line.getProduct().getId()),
                line.getGrn().getId(),line.getGrn().getGrnNumber(),SecurityUtils.canViewCostPrice()?line.getUnitCost():null)).toList();
    }

    private com.nbh.erp.grn.entity.GrnItem latestReceipt(Long warehouseId,Long productId) {
        var matches=grnItems.latestForProduct(warehouseId,productId,org.springframework.data.domain.PageRequest.of(0,1));
        if(matches.isEmpty())throw new BusinessException("No processed GRN contains this product in the selected warehouse. Record a GRN first.");
        var line=matches.getFirst();
        var receipt=grns.findByIdForUpdate(line.getGrn().getId()).orElseThrow();
        if(!"PROCESSED".equals(receipt.getStatus()))throw new BusinessException("The linked GRN is no longer processed. Search the product again.");
        return line;
    }

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
        var ticket=idempotency.reserve("createAdjustment", request.toString()+"|"+autoProcess);
        if(ticket!=null && ticket.getResourceId()!=null) return getAdjustmentById(ticket.getResourceId());

        StockAdjustment adjustment = StockAdjustment.builder()
                .adjustmentNumber(sequenceService.generateAdjustmentNumber()).items(new ArrayList<>()).status("DRAFT").build();
        populateDraft(adjustment, request);

        StockAdjustment saved = adjustmentRepository.save(adjustment);

        if (autoProcess) {
            return idempotency.complete(ticket,saved.getId(),processAdjustmentInternal(saved));
        }

        return idempotency.complete(ticket,saved.getId(),StockAdjustmentDto.from(saved));
    }

    private void populateDraft(StockAdjustment adjustment, CreateStockAdjustmentRequest request) {
        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        if(!Boolean.TRUE.equals(warehouse.getIsActive()))throw new BusinessException("Choose an active warehouse");
        String mode=request.getAdjustmentType()==null?"COUNT":request.getAdjustmentType();
        if(!java.util.Set.of("COUNT","ADDITION","REDUCTION").contains(mode))throw new BusinessException("Choose addition or reduction");
        if(request.getItems()==null || request.getItems().isEmpty())throw new BusinessException("Choose a product");
        adjustment.setWarehouse(warehouse);
        adjustment.setAdjustmentType(mode);
        adjustment.setAdjustmentDate(request.getAdjustmentDate());
        adjustment.setReason(request.getReason());
        adjustment.getItems().clear();
        java.util.Set<Long> seen=new java.util.HashSet<>();
        for (CreateStockAdjustmentRequest.CreateStockAdjustmentItemRequest itemReq : request.getItems()) {
            if(!seen.add(itemReq.getProductId()))throw new BusinessException("Choose each product only once");
            if (itemReq.getUnitCost()!=null && !SecurityUtils.canViewCostPrice()) {
                throw new BusinessException("You do not have permission to set product cost");
            }
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            if(!Boolean.TRUE.equals(product.getIsActive()) || product.getDeletedAt()!=null)throw new BusinessException("Choose an active product");
            var receipt=latestReceipt(warehouse.getId(),product.getId());
            BigDecimal systemQty=stockService.getStockBalance(warehouse.getId(),product.getId()).getQuantity();
            BigDecimal diff,physical;
            if("COUNT".equals(mode)){
                physical=itemReq.getPhysicalQuantity();
                if(physical==null || physical.signum()<0)throw new BusinessException("Enter a valid physical quantity");
                diff=physical.subtract(systemQty);
            }else{
                var quantity=itemReq.getQuantity();
                if(quantity==null || quantity.signum()<=0 || quantity.stripTrailingZeros().scale()>2)throw new BusinessException("Enter an adjustment quantity greater than zero with up to two decimal places");
                diff="REDUCTION".equals(mode)?quantity.negate():quantity;
                physical=systemQty.add(diff);
                if(physical.signum()<0)throw new BusinessException("Reduction exceeds available stock");
            }

            StockAdjustmentItem item = StockAdjustmentItem.builder()
                    .stockAdjustment(adjustment)
                    .product(product)
                    .systemQuantity(systemQty)
                    .physicalQuantity(physical)
                    .differenceQuantity(diff)
                    .unitCost(itemReq.getUnitCost()!=null ? itemReq.getUnitCost() : receipt.getUnitCost())
                    .sourceGrnItem(receipt)
                    .reason(itemReq.getReason())
                    .build();

            adjustment.getItems().add(item);
        }

    }

    @Transactional
    public StockAdjustmentDto updateDraft(Long id, CreateStockAdjustmentRequest request, boolean process) {
        var adjustment=adjustmentRepository.findByIdForUpdate(id)
                .orElseThrow(()->new ResourceNotFoundException("Stock Adjustment","id",id));
        if(!"DRAFT".equals(adjustment.getStatus()))throw new BusinessException("Only draft adjustments can be edited");
        populateDraft(adjustment,request);
        adjustmentRepository.saveAndFlush(adjustment);
        return process?processAdjustmentInternal(adjustment):StockAdjustmentDto.from(adjustment);
    }

    @Transactional
    public StockAdjustmentDto cancelAdjustment(Long id, String reason) {
        if(reason==null || reason.isBlank() || reason.length()>1000)throw new BusinessException("Enter a cancellation reason of up to 1000 characters");
        var adjustment=adjustmentRepository.findByIdForUpdate(id)
                .orElseThrow(()->new ResourceNotFoundException("Stock Adjustment","id",id));
        if(!java.util.Set.of("DRAFT","PROCESSED").contains(adjustment.getStatus()))throw new BusinessException("This adjustment is already cancelled");
        if("PROCESSED".equals(adjustment.getStatus())){
            Long warehouseId=adjustment.getWarehouse().getId();
            for(var item:adjustment.getItems().stream().sorted(java.util.Comparator.comparing(i->i.getProduct().getId())).toList()){
                var delta=item.getDifferenceQuantity();
                String notes="Cancellation: "+reason.trim();
                if(delta.signum()>0)stockService.decreaseStock(warehouseId,item.getProduct().getId(),delta,item.getUnitCost(),"ADJUSTMENT_CANCEL",adjustment.getAdjustmentNumber(),notes);
                else if(delta.signum()<0)stockService.increaseStock(warehouseId,item.getProduct().getId(),delta.negate(),item.getUnitCost(),"ADJUSTMENT_CANCEL",adjustment.getAdjustmentNumber(),notes);
            }
        }
        adjustment.setStatus("CANCELLED");
        adjustmentRepository.save(adjustment);
        auditLogService.log("STOCK_ADJUSTMENT_CANCEL","StockAdjustment",adjustment.getAdjustmentNumber(),reason.trim());
        return StockAdjustmentDto.from(adjustment);
    }

    @Transactional
    public StockAdjustmentDto processAdjustment(Long id) {
        return processAdjustment(id,null);
    }

    @Transactional
    public StockAdjustmentDto processAdjustment(Long id, String reason) {
        StockAdjustment adjustment = adjustmentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock Adjustment", "id", id));
        var result=processAdjustmentInternal(adjustment);
        if(reason!=null && !reason.isBlank())auditLogService.log("STOCK_ADJUSTMENT_STATUS","StockAdjustment",adjustment.getAdjustmentNumber(),reason.trim());
        return result;
    }

    private StockAdjustmentDto processAdjustmentInternal(StockAdjustment adjustment) {
        if ("PROCESSED".equals(adjustment.getStatus())) {
            throw new BusinessException("Adjustment " + adjustment.getAdjustmentNumber() + " is already processed");
        }
        if (!"DRAFT".equals(adjustment.getStatus())) {
            throw new BusinessException("Only draft adjustments can be processed: " + adjustment.getAdjustmentNumber());
        }

        Long warehouseId = adjustment.getWarehouse().getId();
        String currentUsername = SecurityUtils.getCurrentUsername().orElse("system");

        if(!Boolean.TRUE.equals(adjustment.getWarehouse().getIsActive()))throw new BusinessException("Warehouse is inactive");
        for (StockAdjustmentItem item : adjustment.getItems().stream().sorted(java.util.Comparator.comparing(i->i.getProduct().getId())).toList()) {
            if(!Boolean.TRUE.equals(item.getProduct().getIsActive()) || item.getProduct().getDeletedAt()!=null)throw new BusinessException("Product is inactive");
            var receipt=latestReceipt(warehouseId,item.getProduct().getId());
            item.setSourceGrnItem(receipt);
            String notes="Linked GRN "+receipt.getGrn().getGrnNumber()+(item.getReason()!=null?". "+item.getReason():"");
            if("COUNT".equals(adjustment.getAdjustmentType())){
                stockService.getAvailableStockForUpdate(warehouseId,item.getProduct().getId());
                BigDecimal before=stockService.getStockBalance(warehouseId,item.getProduct().getId()).getQuantity();
                stockService.adjustStock(warehouseId,item.getProduct().getId(),item.getPhysicalQuantity(),adjustment.getAdjustmentNumber(),notes);
                item.setSystemQuantity(before);item.setDifferenceQuantity(item.getPhysicalQuantity().subtract(before));
            }else{
                BigDecimal delta=item.getDifferenceQuantity();
                var balance=delta.signum()>0
                    ?stockService.increaseStock(warehouseId,item.getProduct().getId(),delta,item.getUnitCost(),"ADJUSTMENT",adjustment.getAdjustmentNumber(),notes)
                    :stockService.decreaseStock(warehouseId,item.getProduct().getId(),delta.negate(),item.getUnitCost(),"ADJUSTMENT",adjustment.getAdjustmentNumber(),notes);
                item.setPhysicalQuantity(balance.getQuantity());item.setSystemQuantity(balance.getQuantity().subtract(delta));
            }
            if((item.getProduct().getCostPrice()==null || item.getProduct().getCostPrice().signum()==0) && item.getUnitCost()!=null && item.getUnitCost().signum()>0){item.getProduct().setCostPrice(item.getUnitCost());productRepository.save(item.getProduct());}
        }

        adjustment.setStatus("PROCESSED");
        adjustment.setApprovedBy(currentUsername);
        adjustment.setApprovedAt(LocalDateTime.now());
        StockAdjustment updated = adjustmentRepository.save(adjustment);

        auditLogService.log(
                "STOCK_ADJUSTMENT",
                "StockAdjustment",
                adjustment.getAdjustmentNumber(),
                String.format("Stock adjustment %s processed by %s for warehouse %s. Reason: %s",
                        adjustment.getAdjustmentNumber(), currentUsername, adjustment.getWarehouse().getName(), adjustment.getReason())
        );

        log.info("Stock Adjustment '{}' processed successfully by {}", adjustment.getAdjustmentNumber(), currentUsername);
        return StockAdjustmentDto.from(updated);
    }

    @Transactional
    public void rejectAdjustment(Long id) {
        StockAdjustment adjustment = adjustmentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock Adjustment", "id", id));

        if (!"DRAFT".equals(adjustment.getStatus())) {
            throw new BusinessException("Only draft stock adjustments can be rejected");
        }

        adjustment.setStatus("REJECTED");
        adjustmentRepository.save(adjustment);
    }
}
