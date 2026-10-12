package com.nbh.erp.purchaseorder.service;
import com.nbh.erp.purchaseorder.entity.*;
import com.nbh.erp.purchaseorder.dto.*;
import com.nbh.erp.purchaseorder.repository.*;
import com.nbh.erp.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Pageable;
import com.nbh.erp.common.dto.PagedResponse;
import java.math.BigDecimal;
@Service @RequiredArgsConstructor
public class PurchaseOrderService {
 private final PurchaseOrderRepository orders;
 private final com.nbh.erp.supplier.repository.SupplierRepository suppliers;
 private final com.nbh.erp.warehouse.repository.WarehouseRepository warehouses;
 private final com.nbh.erp.product.repository.ProductRepository products;
 private final com.nbh.erp.sequence.service.DocumentSequenceService sequence;
 private final com.nbh.erp.audit.service.AuditLogService audit;
 @Transactional(readOnly=true) public PagedResponse<PurchaseOrderDto> search(String status,String query,Pageable page) { return PagedResponse.from(orders.search(status,query,page).map(PurchaseOrderDto::from)); }
 @Transactional(readOnly=true) public PurchaseOrderDto get(Long id) { return PurchaseOrderDto.from(orders.findById(id).orElseThrow(() -> new BusinessException("Unknown order"))); }
 @Transactional public java.util.Map<Long,com.nbh.erp.warehouse.entity.Warehouse> deliveryWarehouses(Long id,Long supplierId) {
  var po=orders.lockById(id).orElseThrow(()->new BusinessException("Unknown purchase order"));
  var destinations=new java.util.HashMap<Long,com.nbh.erp.warehouse.entity.Warehouse>();
  for(var item:po.getItems()) if(item.getOrderingSupplier().getId().equals(supplierId)) destinations.put(item.getProduct().getId(),item.getDeliveryWarehouse());
  if(destinations.isEmpty()) throw new BusinessException("Supplier has no products in this purchase order");
  return destinations;
 }
 @Transactional public PurchaseOrderDto save(Long id,PurchaseOrderRequest req) {
  var po=id==null ? new PurchaseOrder() : orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown order"));
  if(!java.util.Set.of("DRAFT","INFORM_TO_ORDER").contains(po.getStatus())) throw new BusinessException("Cancelled orders cannot be edited");
  String previousStatus=po.getStatus();
  String nextStatus=req.status()==null ? po.getStatus() : req.status();
  if(!java.util.Set.of("DRAFT","INFORM_TO_ORDER").contains(nextStatus)) throw new BusinessException("Invalid order status");
  String statusReason=id!=null && !previousStatus.equals(nextStatus) ? com.nbh.erp.common.dto.StatusChangeRequest.requireReason(req.statusReason()) : null;
  var receivedLines=new java.util.HashMap<String,PurchaseOrderItem>();
  for(var item:po.getItems()) if(item.getReceivedQuantity().signum()>0) receivedLines.put(item.getProduct().getId()+":"+item.getOrderingSupplier().getId(),item);
  if(!receivedLines.isEmpty()) {
   if(!"INFORM_TO_ORDER".equals(nextStatus)) throw new BusinessException("Reverse linked GRNs before returning this purchase order to draft");
   for(var received:receivedLines.values()) {
    var line=req.items().stream().filter(candidate->candidate.productId().equals(received.getProduct().getId()) && received.getOrderingSupplier().getId().equals(candidate.supplierId()!=null ? candidate.supplierId() : req.supplierId())).findFirst().orElseThrow(()->new BusinessException("Cannot remove a received product; reverse linked GRNs first"));
    if(line.quantity().compareTo(received.getReceivedQuantity())<0) throw new BusinessException("Order quantity cannot be less than the received quantity");
    Long warehouseId=line.warehouseId()!=null ? line.warehouseId() : req.warehouseId()!=null ? req.warehouseId() : received.getProduct().getDefaultWarehouse()==null ? null : received.getProduct().getDefaultWarehouse().getId();
    if(!received.getDeliveryWarehouse().getId().equals(warehouseId)) throw new BusinessException("Reverse linked GRNs before changing a received product's delivery warehouse");
   }
  }
  if(id==null) po.setOrderDate(po.getCreatedAt().toLocalDate());
  if(req.expectedDate()!=null && req.expectedDate().isBefore(po.getOrderDate())) throw new BusinessException("Expected date precedes creation date");
  if(id==null) po.setPoNumber(sequence.getNextNumber("PO"));
  po.setExpectedDate(req.expectedDate()); po.setTerms(req.terms()); po.setNotes(req.notes());
  po.getItems().clear(); var seen=new java.util.HashSet<String>(); BigDecimal total=BigDecimal.ZERO;
  for(var line:req.items()) {
   Long supplierId=line.supplierId()!=null ? line.supplierId() : req.supplierId();
   if(supplierId==null) throw new BusinessException("Select a supplier for every order product");
   if(!seen.add(line.productId()+":"+supplierId)) throw new BusinessException("Duplicate product line for the same supplier");
   var item=new PurchaseOrderItem(); item.setPurchaseOrder(po); item.setProduct(products.findById(line.productId()).orElseThrow(() -> new BusinessException("Unknown product")));
   item.setSupplier(suppliers.findById(supplierId).orElseThrow(()->new BusinessException("Unknown supplier")));
   if(!Boolean.TRUE.equals(item.getSupplier().getIsActive())) throw new BusinessException("Supplier must be active");
   if(!Boolean.TRUE.equals(item.getProduct().getIsActive())) throw new BusinessException("Inactive product");
   Long warehouseId=line.warehouseId()!=null ? line.warehouseId() : req.warehouseId()!=null ? req.warehouseId() : item.getProduct().getDefaultWarehouse()==null ? null : item.getProduct().getDefaultWarehouse().getId();
   if(warehouseId==null) throw new BusinessException("Set a delivery warehouse for product "+item.getProduct().getSku()+" in Inventory first");
   item.setWarehouse(warehouses.findById(warehouseId).orElseThrow(()->new BusinessException("Unknown delivery warehouse")));
   if(!Boolean.TRUE.equals(item.getWarehouse().getIsActive())) throw new BusinessException("Delivery warehouse must be active");
   if(po.getItems().isEmpty()) {po.setWarehouse(item.getWarehouse());po.setSupplier(item.getSupplier());}
   var received=receivedLines.get(line.productId()+":"+supplierId);
   if(received!=null) item.setReceivedQuantity(received.getReceivedQuantity());
   item.setQuantity(line.quantity()); item.setUnitCost(line.unitCost()); po.getItems().add(item); total=total.add(line.quantity().multiply(line.unitCost()));
  }
  po.setTotalAmount(total);
  po.setStatus(nextStatus);
  orders.saveAndFlush(po); audit.log(id==null?"PO_CREATE":"PO_UPDATE","PurchaseOrder",po.getPoNumber(),"Saved purchase order");
  if(id!=null && !previousStatus.equals(po.getStatus())) audit.log("PO_STATUS","PURCHASING","PurchaseOrder",po.getPoNumber(),previousStatus+" -> "+po.getStatus()+": "+statusReason);
  return PurchaseOrderDto.from(po);
 }
 @Transactional public PurchaseOrderDto transition(Long id,String status) {
  return transition(id,status,"Internal purchase order workflow");
 }
 @Transactional public PurchaseOrderDto transition(Long id,String status,String reason) {
  reason=com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
  var po=orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown order"));
  String previous=po.getStatus();
  if(!java.util.Set.of("DRAFT","INFORM_TO_ORDER","CANCELLED").contains(status)) throw new BusinessException("PO status must be Draft, Inform to Order or Cancelled");
  if(status.equals(previous)) return PurchaseOrderDto.from(po);
  if(!java.util.Set.of("DRAFT","INFORM_TO_ORDER","CANCELLED").contains(previous)) throw new BusinessException("Invalid order transition");
  if(!"INFORM_TO_ORDER".equals(status) && po.getItems().stream().anyMatch(item -> item.getReceivedQuantity().signum()>0)) throw new BusinessException("Reverse linked GRNs before cancelling or returning this purchase order to draft");
  po.setStatus(status);
  orders.save(po); audit.log("PO_STATUS","PURCHASING","PurchaseOrder",po.getPoNumber(),previous+" -> "+status+": "+reason); return PurchaseOrderDto.from(po);
 }
 @Transactional public void receive(Long id,Long supplier,Long warehouse,java.util.Map<Long,BigDecimal> quantities,boolean reverse) {
  var po=orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown purchase order"));
  if(!"INFORM_TO_ORDER".equals(po.getStatus())) throw new BusinessException("Purchase order must be Inform to Order before receiving stock");
  for(var line:quantities.entrySet()) {
   var item=po.getItems().stream().filter(i -> i.getProduct().getId().equals(line.getKey()) && i.getOrderingSupplier().getId().equals(supplier)).findFirst().orElseThrow(() -> new BusinessException("Product not ordered"));
   if(!item.getDeliveryWarehouse().getId().equals(warehouse)) throw new BusinessException("Product must be received in its saved PO delivery warehouse");
   BigDecimal next=reverse ? item.getReceivedQuantity().subtract(line.getValue()) : item.getReceivedQuantity().add(line.getValue());
   if(next.signum()<0 || next.compareTo(item.getQuantity())>0) throw new BusinessException("Receipt exceeds order quantity"); item.setReceivedQuantity(next);
  }
  orders.save(po);
  audit.log("PO_RECEIPT","PURCHASING","PurchaseOrder",po.getPoNumber(),"Linked GRN quantities "+(reverse?"reversed ":"received ")+quantities);
 }
}
