package com.nbh.erp.purchaseorder.repository;
import com.nbh.erp.purchaseorder.entity.PurchaseOrder;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder,Long> {
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from PurchaseOrder p where p.id=:id") Optional<PurchaseOrder> lockById(Long id);
 @Query("select p from PurchaseOrder p where (:status is null or p.status=:status) and (:query is null or lower(p.poNumber) like lower(concat('%',:query,'%')) or lower(p.supplier.name) like lower(concat('%',:query,'%')))")
 Page<PurchaseOrder> search(String status,String query,Pageable pageable);
}
