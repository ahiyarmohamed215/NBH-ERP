package com.nbh.erp.inventory.repository;

import com.nbh.erp.inventory.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    List<StockMovement> findByProductIdAndWarehouseIdOrderByCreatedAtDesc(Long productId, Long warehouseId);

    List<StockMovement> findByReferenceNumberOrderByCreatedAtDesc(String referenceNumber);

    @Query("SELECT sm FROM StockMovement sm WHERE " +
            "(:warehouseId IS NULL OR sm.warehouse.id = :warehouseId) AND " +
            "(:productId IS NULL OR sm.product.id = :productId) AND " +
            "(:movementType IS NULL OR sm.movementType = :movementType) AND " +
            "(:startDate IS NULL OR sm.createdAt >= :startDate) AND " +
            "(:endDate IS NULL OR sm.createdAt <= :endDate) " +
            "ORDER BY sm.createdAt DESC")
    Page<StockMovement> findLedger(
            @Param("warehouseId") Long warehouseId,
            @Param("productId") Long productId,
            @Param("movementType") String movementType,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );
}
