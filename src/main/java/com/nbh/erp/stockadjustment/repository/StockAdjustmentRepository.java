package com.nbh.erp.stockadjustment.repository;

import com.nbh.erp.stockadjustment.entity.StockAdjustment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {

    Optional<StockAdjustment> findByAdjustmentNumber(String adjustmentNumber);

    @Query("SELECT sa FROM StockAdjustment sa WHERE " +
            "(:warehouseId IS NULL OR sa.warehouse.id = :warehouseId) AND " +
            "(:status IS NULL OR sa.status = :status) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(sa.adjustmentNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<StockAdjustment> searchAdjustments(
            @Param("warehouseId") Long warehouseId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );
}
