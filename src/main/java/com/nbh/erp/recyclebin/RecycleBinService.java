package com.nbh.erp.recyclebin;

import com.nbh.erp.common.entity.RecyclableEntity;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.supplier.service.SupplierService;
import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.user.entity.User;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class RecycleBinService {
    private final EntityManager entities;
    private final SupplierService suppliers;
    private final AuditLogService audit;
    private final StockService stock;
    private final com.nbh.erp.inventory.repository.StockBalanceRepository balances;
    private static final Map<String,Class<? extends RecyclableEntity>> TYPES=Map.of(
        "BRAND",com.nbh.erp.brand.entity.Brand.class,"CATEGORY",com.nbh.erp.category.entity.Category.class,
        "WAREHOUSE",com.nbh.erp.warehouse.entity.Warehouse.class,"CUSTOMER",com.nbh.erp.customer.entity.Customer.class,
        "USER",User.class,"ALLOCATION",ProductStaffQuota.class);
    public record Entry(String type,Long id,String code,String name,LocalDateTime deletedAt) {}
    private String permission(String type) { return "ALLOCATION".equals(type)?"INVENTORY":type; }
    private void authorize(String type) { SecurityUtils.enforceCanEdit(permission(type),"Recycle bin: "+type); }
    private RecyclableEntity locked(String type,Long id) {
        authorize(type);Class<? extends RecyclableEntity> cls=TYPES.get(type);
        if(cls==null) throw new BusinessException("Unsupported recycle bin record type");
        RecyclableEntity record=entities.find(cls,id,LockModeType.PESSIMISTIC_WRITE);
        if(record==null) throw new BusinessException("Record not found");
        if(record instanceof User user) {
            SecurityUtils.protectUser(user);
            if(SecurityUtils.isSuperAdmin(user)) throw new BusinessException("The super administrator account cannot be deleted");
            if(SecurityUtils.getCurrentUserId().filter(id::equals).isPresent()) throw new BusinessException("You cannot delete or restore your own account");
        }
        return record;
    }
    private String value(Object entity,String method) {
        try { Object result=entity.getClass().getMethod(method).invoke(entity);return result==null?"—":result.toString(); }
        catch(ReflectiveOperationException ignored) { return "—"; }
    }
    private Entry entry(String type,RecyclableEntity record) {
        String name=record instanceof User ? value(record,"getFullName") : record instanceof ProductStaffQuota quota ? (quota.getProduct()==null?"Draft allocation":quota.getProduct().getName())+" / "+(quota.getUser()==null?"Unassigned":quota.getUser().getFullName()) : value(record,"getName");
        String code=record instanceof User ? value(record,"getEmployeeCode") : "CUSTOMER".equals(type)?value(record,"getCustomerCode"):value(record,"getCode");
        return new Entry(type,record.getId(),"—".equals(code)?String.valueOf(record.getId()):code,name,record.getDeletedAt());
    }
    @Transactional(readOnly=true) public List<Entry> list() {
        List<Entry> result=new ArrayList<>();
        if(SecurityUtils.canEdit("SUPPLIER")) suppliers.getRecycleBin().forEach(s -> result.add(new Entry("SUPPLIER",s.getId(),s.getSupplierCode(),s.getName(),s.getDeletedAt())));
        TYPES.forEach((type,cls)->{if(SecurityUtils.canEdit(permission(type))) entities.createQuery("select e from "+cls.getSimpleName()+" e where e.deletedAt is not null and e.purgedAt is null",cls).getResultList().forEach(record->result.add(entry(type,record)));});
        result.sort(Comparator.comparing(Entry::deletedAt).reversed());return result;
    }
    @Transactional public void delete(String type,Long id) {
        if("SUPPLIER".equals(type)){authorize(type);suppliers.deleteSupplier(id);return;}
        RecyclableEntity record=locked(type,id);record.requireNotDeleted();
        record.setActiveBeforeDelete(record.getIsActive());
        if(record instanceof ProductStaffQuota quota){record.setStatusBeforeDelete(quota.getAllocationStatus());quota.setAllocationStatus("INACTIVE");}
        record.setIsActive(false);record.setDeletedAt(LocalDateTime.now());
        if(record instanceof User user) user.setTokenVersion(user.getTokenVersion()+1);
        audit.log("RECORD_DELETE",type,String.valueOf(id),"Moved to global recycle bin");
    }
    @Transactional public void restore(String type,Long id) {
        if("SUPPLIER".equals(type)){authorize(type);suppliers.restoreSupplier(id);return;}
        RecyclableEntity record=locked(type,id);
        if(!record.isDeleted() || record.getPurgedAt()!=null) throw new BusinessException("Only records in the recycle bin can be restored");
        if(record instanceof ProductStaffQuota quota && Boolean.TRUE.equals(record.getActiveBeforeDelete())) {
            if(quota.getProduct()==null || quota.getUser()==null || !Boolean.TRUE.equals(quota.getProduct().getIsActive()) || !Boolean.TRUE.equals(quota.getUser().getIsActive()) || (quota.getWarehouse()!=null && !Boolean.TRUE.equals(quota.getWarehouse().getIsActive()))) throw new BusinessException("Restore and activate the linked product, employee and warehouse first");
            var available=quota.getWarehouse()!=null?stock.getAvailableStock(quota.getWarehouse().getId(),quota.getProduct().getId()):balances.getTotalEnterpriseStockForProduct(quota.getProduct().getId());
            if(available==null)available=java.math.BigDecimal.ZERO;
            if(quota.getRemainingQuantity().compareTo(available)>0) throw new BusinessException("Not enough available stock to restore this active allocation");
        }
        record.setDeletedAt(null);record.setIsActive(Boolean.TRUE.equals(record.getActiveBeforeDelete()));
        if(record instanceof ProductStaffQuota quota) quota.setAllocationStatus(record.getStatusBeforeDelete());
        record.setActiveBeforeDelete(null);record.setStatusBeforeDelete(null);
        if(record instanceof User user) user.setTokenVersion(user.getTokenVersion()+1);
        audit.log("RECORD_RESTORE",type,String.valueOf(id),"Restored from global recycle bin");
    }
    @Transactional public void purge(String type,Long id) {
        if("SUPPLIER".equals(type)){authorize(type);suppliers.permanentlyDeleteSupplier(id);return;}
        RecyclableEntity record=locked(type,id);
        if(!record.isDeleted() || record.getPurgedAt()!=null) throw new BusinessException("Only records in the recycle bin can be permanently deleted");
        record.setPurgedAt(LocalDateTime.now());record.setActiveBeforeDelete(null);record.setStatusBeforeDelete(null);
        if(record instanceof com.nbh.erp.customer.entity.Customer customer){customer.setContactPerson(null);customer.setEmail(null);customer.setPhone(null);customer.setAddress(null);}
        if(record instanceof com.nbh.erp.warehouse.entity.Warehouse warehouse){warehouse.setContactPerson(null);warehouse.setPhone(null);warehouse.setAddress(null);}
        if(record instanceof com.nbh.erp.brand.entity.Brand brand)brand.setDescription(null);
        if(record instanceof com.nbh.erp.category.entity.Category category)category.setDescription(null);
        if(record instanceof ProductStaffQuota allocation)allocation.setNotes(null);
        if(record instanceof User user){user.setPhone(null);user.setEmail("deleted-"+user.getId()+"@deleted.invalid");user.setPassword(java.util.UUID.randomUUID().toString());user.getRoles().clear();user.setTokenVersion(user.getTokenVersion()+1);}
        audit.log("RECORD_PURGE",type,String.valueOf(id),"Permanently removed; historical references retained");
    }
}
