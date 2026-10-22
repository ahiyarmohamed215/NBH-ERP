package com.nbh.erp.sales.service;

import com.nbh.erp.sales.entity.*;
import com.nbh.erp.sales.repository.*;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.stockadjustment.entity.*;
import com.nbh.erp.stockadjustment.repository.StockAdjustmentRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.audit.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.math.*;
import java.time.*;

/** A single transaction owns the review, physical count records and reservation changes. */
@Service @RequiredArgsConstructor
public class HeldWarehouseWorkflow {
    private final InvoiceRepository invoices;
    private final StockService stock;
    private final StockAdjustmentRepository adjustments;
    private final DocumentSequenceService numbers;
    private final AuditLogService audit;
    private final Clock clock;
    private final HeldOriginalsService originals;
    private final PosAllocationService allocations;
    private final org.springframework.context.ApplicationEventPublisher events;

    public record SendRequest(Long expectedVersion,String assignedStaff,Boolean printNow) {
        public SendRequest(Long version,String staff){this(version,staff,true);}
    }
    public record ReviewLine(Long itemId,BigDecimal approvedQuantity,BigDecimal physicalStock) {}
    public record ReviewRequest(Long expectedVersion,String remarks,List<ReviewLine> items) {}

    public void access(Invoice bill){
        com.nbh.erp.customer.repository.CustomerRepository.requireActive(bill.getCustomer());
        String name=SecurityUtils.getCurrentUsername().orElse("");
        if(!(SecurityUtils.isAdministrator() || SecurityUtils.hasAuthority("SALES_VIEW_ALL")) && !(SecurityUtils.hasAuthority("SALES_EDIT") && !"HELD".equals(bill.getStatus())) && !Objects.equals(name,bill.getCreatedBy()))
            throw new org.springframework.security.access.AccessDeniedException("You do not have permission to access this held bill");
    }
    private Invoice lock(Long id,Long version){
        Invoice bill=invoices.findByIdForUpdate(id).orElseThrow(()->new BusinessException("Held bill not found"));access(bill);
        if(version==null || version!=bill.getRecordVersion())throw new BusinessException("This bill changed. Reopen it before continuing.");
        return bill;
    }
    @Transactional
    public InvoiceDto send(Long id,SendRequest request){
        Invoice bill=lock(id,request.expectedVersion());
        if(!"HELD".equals(bill.getStatus()))throw new BusinessException("Only held bills can be sent to the warehouse");
        bill.setAssignedStaff(null);
        originals.capture(bill);
        if(!Boolean.FALSE.equals(request.printNow())){
            bill.setStatus("SENT_TO_WAREHOUSE");
            if(bill.getOriginalHeldSnapshot()!=null && bill.getOriginalHeldSentAt()==null)
                bill.setOriginalHeldSentAt(LocalDateTime.now(clock));
        } else {
            bill.setStatus("YET_TO_PRINT");
        }
        invoices.saveAndFlush(bill);
        if("SENT_TO_WAREHOUSE".equals(bill.getStatus()))events.publishEvent(new HeldPerformanceChanged(bill.getId()));
        audit.log("ONHOLD_SENT","Invoice",bill.getHeldNumber(),"Onhold bill saved for warehouse review");
        return InvoiceDto.from(bill);
    }
    @Transactional
    public InvoiceDto reprint(Long id,Long warehouseId){
        Invoice bill=invoices.findByIdForUpdate(id).orElseThrow();access(bill);
        if("HELD".equals(bill.getStatus()) || "CANCELLED".equals(bill.getStatus()))throw new BusinessException("Send this bill to the warehouse first");
        if(warehouseId!=null && bill.getOriginalHeldSnapshot()==null && bill.getItems().stream().noneMatch(i->i.fulfillmentWarehouse().getId().equals(warehouseId)))throw new BusinessException("Warehouse is not part of this bill");
        audit.log("HELD_REPRINT","Invoice",bill.getHeldNumber(),"Explicitly requested another warehouse copy");
        if("YET_TO_PRINT".equals(bill.getStatus())){
            bill.setStatus("SENT_TO_WAREHOUSE");
            if(bill.getOriginalHeldSnapshot()!=null && bill.getOriginalHeldSentAt()==null)
                bill.setOriginalHeldSentAt(LocalDateTime.now(clock));
            invoices.saveAndFlush(bill);
            events.publishEvent(new HeldPerformanceChanged(bill.getId()));
        }
        return InvoiceDto.from(bill);
    }
    public record ReviewStock(Long productId,Long warehouseId,BigDecimal availableForBill,BigDecimal otherReserved) {}
    public record ReviewLimits(List<PosAllocationService.Limit> limits,List<ReviewStock> stock) {}
    @Transactional(readOnly=true)
    public ReviewLimits reviewLimits(Long id){
        var bill=invoices.findById(id).orElseThrow(()->new BusinessException("Onhold bill not found"));access(bill);
        var rows=new LinkedHashMap<String,ReviewStock>();
        for(var item:bill.getItems()){
            Long product=item.getProduct().getId(),warehouse=item.fulfillmentWarehouse().getId();var key=warehouse+":"+product;if(rows.containsKey(key))continue;
            var own=Boolean.TRUE.equals(bill.getStockReserved())?bill.getItems().stream().filter(line->line.getProduct().getId().equals(product) && line.fulfillmentWarehouse().getId().equals(warehouse)).map(InvoiceItem::getQuantity).reduce(BigDecimal.ZERO,BigDecimal::add):BigDecimal.ZERO;
            var balance=stock.getStockBalance(warehouse,product);
            var reserved=balance.getReservedQuantity()==null?BigDecimal.ZERO:balance.getReservedQuantity();
            rows.put(key,new ReviewStock(product,warehouse,stock.getAvailableStock(warehouse,product).add(own),reserved.subtract(own).max(BigDecimal.ZERO)));
        }
        return new ReviewLimits(allocations.forBill(bill),new ArrayList<>(rows.values()));
    }
    @Transactional
    public InvoiceDto review(Long id,ReviewRequest request){
        SecurityUtils.requirePermission("SALES_EDIT");
        Invoice bill=lock(id,request.expectedVersion());
        if(!"SENT_TO_WAREHOUSE".equals(bill.getStatus()))throw new BusinessException("Only bills sent to the warehouse can be reviewed");
        if(bill.getOriginalHeldSnapshot()==null){originals.capture(bill);bill.setOriginalHeldSentAt(LocalDateTime.now(clock));}
        String name=SecurityUtils.getCurrentUsername().orElseThrow();
        if(request.items()==null || request.items().size()!=bill.getItems().size())throw new BusinessException("Review every bill line");
        Map<Long,ReviewLine> input=new HashMap<>();
        for(var line:request.items()){
            if(line.itemId()==null || input.put(line.itemId(),line)!=null)throw new BusinessException("Duplicate or missing bill line");
            if(line.approvedQuantity()==null || line.approvedQuantity().signum()<0 || line.approvedQuantity().stripTrailingZeros().scale()>2)throw new BusinessException("Enter approved quantities with up to two decimals");
            if(line.physicalStock()!=null && (line.physicalStock().signum()<0 || line.physicalStock().stripTrailingZeros().scale()>2))throw new BusinessException("Enter a valid total physical stock count");
        }
        if(request.items().stream().anyMatch(i->i.physicalStock()!=null))SecurityUtils.requirePermission("INVENTORY_ADJUST");
        if(request.remarks()==null || request.remarks().isBlank() || request.remarks().length()>1000)throw new BusinessException("Enter warehouse review remarks, up to 1000 characters");
        allocations.lockStaff(bill);
        var ordered=bill.getItems().stream().sorted(Comparator.comparing((InvoiceItem i)->i.fulfillmentWarehouse().getId()).thenComparing(i->i.getProduct().getId())).toList();
        boolean reserved=Boolean.TRUE.equals(bill.getStockReserved());
        if(reserved)for(var item:ordered)stock.changeReservation(item.fulfillmentWarehouse().getId(),item.getProduct().getId(),item.getQuantity().negate());
        Map<String,StockAdjustment> documents=new TreeMap<>();Set<String> counts=new HashSet<>();
        for(var item:ordered){
            var line=input.get(item.getId());if(line==null)throw new BusinessException("Bill line does not match this review");
            if(!Boolean.TRUE.equals(item.fulfillmentWarehouse().getIsActive()) || !Boolean.TRUE.equals(item.getProduct().getIsActive()))throw new BusinessException("A bill product or warehouse is inactive");
            if(item.getQuantity().compareTo(line.approvedQuantity())!=0){
                var review=documents.computeIfAbsent("REVIEW:"+item.fulfillmentWarehouse().getId(),k->StockAdjustment.builder().adjustmentNumber(numbers.generateAdjustmentNumber())
                    .warehouse(item.fulfillmentWarehouse()).sourceHeldBillId(id).sourceHeldBillNumber(bill.getHeldNumber()).adjustmentDate(LocalDate.now(clock))
                    .adjustmentType("ORDER_REVIEW").reason("Onhold Bill "+bill.getHeldNumber()+": bill quantities revised from returned warehouse sheets. "+request.remarks())
                    .status("PROCESSED").approvedBy(name).approvedAt(LocalDateTime.now(clock)).build());
                review.getItems().add(StockAdjustmentItem.builder().stockAdjustment(review).product(item.getProduct()).systemQuantity(item.getQuantity()).physicalQuantity(line.approvedQuantity())
                    .differenceQuantity(line.approvedQuantity().subtract(item.getQuantity())).unitCost(item.getCostPrice()).reason("Bill quantity change; physical stock unchanged").build());
            }
            if(line.physicalStock()!=null){
                String key=item.fulfillmentWarehouse().getId()+":"+item.getProduct().getId();
                if(!counts.add(key))throw new BusinessException("Enter the total physical count only once per product and warehouse");
                Long wh=item.fulfillmentWarehouse().getId();stock.getAvailableStockForUpdate(wh,item.getProduct().getId());
                BigDecimal before=stock.getStockBalance(wh,item.getProduct().getId()).getQuantity();
                if(before.compareTo(line.physicalStock())!=0){
                    var doc=documents.computeIfAbsent("COUNT:"+wh+":"+line.physicalStock().compareTo(before),k->StockAdjustment.builder().adjustmentNumber(numbers.generateAdjustmentNumber()).warehouse(item.fulfillmentWarehouse()).sourceHeldBillId(id).sourceHeldBillNumber(bill.getHeldNumber()).adjustmentDate(LocalDate.now(clock)).reason("Onhold Bill "+bill.getHeldNumber()+": "+request.remarks()).status("PROCESSED").approvedBy(name).approvedAt(LocalDateTime.now(clock)).build());
                    stock.adjustStock(wh,item.getProduct().getId(),line.physicalStock(),doc.getAdjustmentNumber(),doc.getReason());
                    doc.getItems().add(StockAdjustmentItem.builder().stockAdjustment(doc).product(item.getProduct()).systemQuantity(before).physicalQuantity(line.physicalStock()).differenceQuantity(line.physicalStock().subtract(before)).unitCost(item.getCostPrice()).reason("On-hold bill "+bill.getHeldNumber()).build());
                }
            }
            BigDecimal approved=line.approvedQuantity();
            BigDecimal discount=item.getQuantity().signum()==0?BigDecimal.ZERO:item.getDiscountAmount().multiply(approved).divide(item.getQuantity(),2,RoundingMode.HALF_UP);
            item.setQuantity(approved);item.setDiscountAmount(discount);item.setTotalPrice(approved.multiply(item.getUnitPrice()).subtract(discount));
        }
        bill.getItems().removeIf(i->i.getQuantity().signum()==0);
        if(bill.getItems().isEmpty())throw new BusinessException("No approved products remain. Cancel the held bill instead.");
        allocations.validate(bill);
        Map<String,BigDecimal> approvedTotals=new TreeMap<>();
        for(var item:bill.getItems())approvedTotals.merge(item.fulfillmentWarehouse().getId()+":"+item.getProduct().getId(),item.getQuantity(),BigDecimal::add);
        for(var item:bill.getItems()){
            var key=item.fulfillmentWarehouse().getId()+":"+item.getProduct().getId();
            var approvedTotal=approvedTotals.remove(key);if(approvedTotal==null)continue;
            if(approvedTotal.compareTo(stock.getAvailableStockForUpdate(item.fulfillmentWarehouse().getId(),item.getProduct().getId()))>0)
                throw new BusinessException("Approved quantity exceeds available warehouse stock for "+item.getProduct().getName());
        }
        adjustments.saveAll(documents.values());
        bill.setSubtotal(bill.getItems().stream().map(InvoiceItem::getTotalPrice).reduce(BigDecimal.ZERO,BigDecimal::add));
        if(bill.getDiscountAmount().compareTo(bill.getSubtotal())>0)throw new BusinessException("Bill discount exceeds the approved subtotal. Revise the bill before sending.");
        bill.setTaxAmount(bill.getSubtotal().subtract(bill.getDiscountAmount()).multiply(bill.getTaxRate()).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP));
        bill.setNetTotal(bill.getSubtotal().subtract(bill.getDiscountAmount()).add(bill.getTaxAmount()));bill.setBalanceAmount(bill.getNetTotal());
        if(reserved)for(var item:ordered)if(item.getQuantity().signum()>0)stock.changeReservation(item.fulfillmentWarehouse().getId(),item.getProduct().getId(),item.getQuantity());
        bill.setStatus("STOCK_ADJUSTED");bill.setReviewedBy(name);bill.setReviewedAt(LocalDateTime.now(clock));
        bill.setNotes((bill.getNotes()==null?"":bill.getNotes()+"\n")+"Warehouse review: "+request.remarks());
        invoices.saveAndFlush(bill);audit.log("HELD_STOCK_REVIEW","Invoice",bill.getHeldNumber(),request.remarks());return InvoiceDto.from(bill);
    }
}
