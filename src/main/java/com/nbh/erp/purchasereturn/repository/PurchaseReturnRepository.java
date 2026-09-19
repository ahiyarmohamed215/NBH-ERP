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
