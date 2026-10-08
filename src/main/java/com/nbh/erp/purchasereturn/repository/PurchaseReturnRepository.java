package com.nbh.erp.purchasereturn.repository;

import com.nbh.erp.purchasereturn.entity.PurchaseReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturn, Long> {
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(i.quantityReturned),0) from PurchaseReturnItem i where i.purchaseReturn.sourceGrnId=:grnId and i.product.id=:productId and i.purchaseReturn.status='PROCESSED'")
    java.math.BigDecimal returnedQuantity(Long grnId,Long productId);
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(p.totalAmount),0) from PurchaseReturn p where p.sourceGrnId=:id and p.status='PROCESSED'") java.math.BigDecimal totalReturned(Long id);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from PurchaseReturn e where e.id = :id")
    java.util.Optional<PurchaseReturn> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    Optional<PurchaseReturn> findByPrnNumber(String prnNumber);

    @Query("SELECT p FROM PurchaseReturn p WHERE " +
            "(:warehouseId IS NULL OR p.warehouse.id = :warehouseId) AND " +
            "(:supplierId IS NULL OR p.supplier.id = :supplierId) AND " +
            "(:status IS NULL OR p.status = :status) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(p.prnNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<PurchaseReturn> searchPurchaseReturns(
            @Param("warehouseId") Long warehouseId,
            @Param("supplierId") Long supplierId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );
}
