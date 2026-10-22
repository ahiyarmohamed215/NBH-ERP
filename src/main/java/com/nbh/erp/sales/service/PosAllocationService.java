package com.nbh.erp.sales.service;

import com.nbh.erp.inventory.repository.ProductStaffQuotaRepository;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class PosAllocationService {
 private final ProductStaffQuotaRepository quotas;
 private final InvoiceRepository invoices;
 private final UserRepository users;
 private final Clock clock;
 public record Limit(Long productId,Long warehouseId,BigDecimal remainingQuantity) {}
 private record Key(Long product,Long warehouse) {}
 @Transactional(readOnly=true)
 public List<Limit> current(Long excludeId){
  var staff=SecurityUtils.getCurrentUserId().flatMap(users::findById).orElseGet(()->users.findByUsername(SecurityUtils.getCurrentUsername().orElse("")).orElse(null));
  return staff==null?List.of():remaining(staff.getId(),staff.getUsername(),excludeId);
 }
 @Transactional(readOnly=true)
 public List<Limit> forBill(Invoice bill){
  var staff=bill.getSalesman()!=null?bill.getSalesman():users.findByUsername(bill.getCreatedBy()==null?"":bill.getCreatedBy()).orElse(null);
  return staff==null?List.of():remaining(staff.getId(),staff.getUsername(),bill.getId());
 }
 public void lockStaff(Invoice bill){if(bill.getSalesman()!=null)users.findByIdForUpdate(bill.getSalesman().getId()).orElseThrow();}
 private List<Limit> remaining(Long staffId,String username,Long excludeId){
  var today=LocalDate.now(clock);Map<Key,BigDecimal> budget=new LinkedHashMap<>();
  for(var quota:quotas.findByUserId(staffId)){
   if(quota.isDeleted() || !Boolean.TRUE.equals(quota.getIsActive()) || quota.getProduct()==null || (quota.getValidFrom()!=null && today.isBefore(quota.getValidFrom())))continue;
   var amount=quota.getValidTo()!=null && today.isAfter(quota.getValidTo())?BigDecimal.ZERO:quota.getRemainingQuantity();
   budget.merge(new Key(quota.getProduct().getId(),quota.getWarehouse()==null?null:quota.getWarehouse().getId()),amount,BigDecimal::add);
  }
  var pending=new TreeMap<String,Map.Entry<Key,BigDecimal>>();
  for(var bill:invoices.findByStatusIn(Set.of("HELD","YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED"))){
   if(Objects.equals(bill.getId(),excludeId) || !(bill.getSalesman()!=null?Objects.equals(bill.getSalesman().getId(),staffId):Objects.equals(bill.getCreatedBy(),username)))continue;
   for(var line:bill.getItems()){
    Key key=new Key(line.getProduct().getId(),line.fulfillmentWarehouse().getId());String order=key.product()+":"+key.warehouse();
    var old=pending.get(order);pending.put(order,Map.entry(key,line.getQuantity().add(old==null?BigDecimal.ZERO:old.getValue())));
   }
  }
  for(var entry:pending.values()){
   var key=entry.getKey();var amount=entry.getValue();var specific=budget.getOrDefault(key,BigDecimal.ZERO);var used=specific.min(amount);
   if(budget.containsKey(key))budget.put(key,specific.subtract(used));
   var global=new Key(key.product(),null);if(budget.containsKey(global))budget.put(global,budget.get(global).subtract(amount.subtract(used)).max(BigDecimal.ZERO));
  }
  return budget.entrySet().stream().map(entry->new Limit(entry.getKey().product(),entry.getKey().warehouse(),entry.getValue())).toList();
 }
 /** Staff lock serializes parallel POS submissions before their allocation is reserved by the held bill. */
 public void validate(Invoice bill){
  if(bill.getSalesman()==null)return;
  var staff=users.findByIdForUpdate(bill.getSalesman().getId()).orElseThrow();
  var limits=remaining(staff.getId(),staff.getUsername(),bill.getId());
  Map<Key,BigDecimal> requested=new HashMap<>();for(var line:bill.getItems())requested.merge(new Key(line.getProduct().getId(),line.fulfillmentWarehouse().getId()),line.getQuantity(),BigDecimal::add);
  for(Long product:requested.keySet().stream().map(Key::product).distinct().toList()){
   var applicable=limits.stream().filter(limit->limit.productId().equals(product)).toList();if(applicable.isEmpty())continue;
   BigDecimal extra=BigDecimal.ZERO;
   for(var entry:requested.entrySet())if(entry.getKey().product().equals(product)){
    var specific=applicable.stream().filter(limit->Objects.equals(limit.warehouseId(),entry.getKey().warehouse())).map(Limit::remainingQuantity).reduce(BigDecimal.ZERO,BigDecimal::add);
    extra=extra.add(entry.getValue().subtract(specific).max(BigDecimal.ZERO));
   }
   var global=applicable.stream().filter(limit->limit.warehouseId()==null).map(Limit::remainingQuantity).reduce(BigDecimal.ZERO,BigDecimal::add);
   if(extra.compareTo(global)>0)throw new BusinessException("The POS quantity exceeds this staff member's remaining stock allocation. Refresh stock or reduce the quantity.");
  }
 }
}
