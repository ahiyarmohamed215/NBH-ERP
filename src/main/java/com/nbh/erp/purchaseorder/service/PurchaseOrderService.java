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
 @Transactional public PurchaseOrderDto save(Long id,PurchaseOrderRequest req) {
  var po=id==null ? new PurchaseOrder() : orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown order"));
  if(!"PENDING".equals(po.getStatus())) throw new BusinessException("Only pending orders can be edited");
  po.setSupplier(suppliers.findById(req.supplierId()).orElseThrow(() -> new BusinessException("Unknown supplier")));
  po.setWarehouse(warehouses.findById(req.warehouseId()).orElseThrow(() -> new BusinessException("Unknown warehouse")));
  if(!Boolean.TRUE.equals(po.getSupplier().getIsActive()) || !Boolean.TRUE.equals(po.getWarehouse().getIsActive())) throw new BusinessException("Supplier and warehouse must be active");
  if(req.expectedDate()!=null && req.expectedDate().isBefore(req.orderDate())) throw new BusinessException("Expected date precedes order date");
  if(id==null) po.setPoNumber(sequence.getNextNumber("PO"));
  po.setOrderDate(req.orderDate()); po.setExpectedDate(req.expectedDate()); po.setTerms(req.terms()); po.setNotes(req.notes());
  po.getItems().clear(); var seen=new java.util.HashSet<Long>(); BigDecimal total=BigDecimal.ZERO;
  for(var line:req.items()) {
   if(!seen.add(line.productId())) throw new BusinessException("Duplicate product line");
   var item=new PurchaseOrderItem(); item.setPurchaseOrder(po); item.setProduct(products.findById(line.productId()).orElseThrow(() -> new BusinessException("Unknown product")));
   if(!Boolean.TRUE.equals(item.getProduct().getIsActive())) throw new BusinessException("Inactive product");
   item.setQuantity(line.quantity()); item.setUnitCost(line.unitCost()); po.getItems().add(item); total=total.add(line.quantity().multiply(line.unitCost()));
  }
  po.setTotalAmount(total);
  if(req.status()!=null && !java.util.Set.of("PENDING","APPROVED").contains(req.status())) throw new BusinessException("Invalid order status");
  if("APPROVED".equals(req.status())) po.setStatus("APPROVED");
  orders.save(po); audit.log(id==null?"PO_CREATE":"PO_UPDATE","PurchaseOrder",po.getPoNumber(),"Saved purchase order");
  return PurchaseOrderDto.from(po);
 }
 @Transactional public PurchaseOrderDto transition(Long id,String status) {
  var po=orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown order"));
  if("APPROVED".equals(status) && "PENDING".equals(po.getStatus())) po.setStatus(status);
  else if("CANCELLED".equals(status) && java.util.Set.of("PENDING","APPROVED").contains(po.getStatus())) po.setStatus(status);
  else throw new BusinessException("Invalid order transition; received orders cannot be cancelled");
  orders.save(po); audit.log("PO_STATUS","PurchaseOrder",po.getPoNumber(),status); return PurchaseOrderDto.from(po);
 }
 @Transactional public void receive(Long id,Long supplier,Long warehouse,java.util.Map<Long,BigDecimal> quantities,boolean reverse) {
  var po=orders.lockById(id).orElseThrow(() -> new BusinessException("Unknown purchase order"));
  if(!po.getSupplier().getId().equals(supplier) || !po.getWarehouse().getId().equals(warehouse)) throw new BusinessException("Purchase order supplier/warehouse mismatch");
  if(!java.util.Set.of("APPROVED","PARTIAL","RECEIVED").contains(po.getStatus())) throw new BusinessException("Purchase order must be approved");
  for(var line:quantities.entrySet()) {
   var item=po.getItems().stream().filter(i -> i.getProduct().getId().equals(line.getKey())).findFirst().orElseThrow(() -> new BusinessException("Product not ordered"));
   BigDecimal next=reverse ? item.getReceivedQuantity().subtract(line.getValue()) : item.getReceivedQuantity().add(line.getValue());
   if(next.signum()<0 || next.compareTo(item.getQuantity())>0) throw new BusinessException("Receipt exceeds order quantity"); item.setReceivedQuantity(next);
  }
  boolean all=po.getItems().stream().allMatch(i -> i.getReceivedQuantity().compareTo(i.getQuantity())==0);
  boolean any=po.getItems().stream().anyMatch(i -> i.getReceivedQuantity().signum()>0);
  po.setStatus(all?"RECEIVED":any?"PARTIAL":"APPROVED"); orders.save(po);
 }
}
