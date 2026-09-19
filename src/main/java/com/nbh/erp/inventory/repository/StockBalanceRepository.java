package com.nbh.erp.inventory.repository;

import com.nbh.erp.inventory.entity.StockBalance;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface StockBalanceRepository extends JpaRepository<StockBalance, Long> {

    Optional<StockBalance> findByWarehouseIdAndProductId(Long warehouseId, Long productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT sb FROM StockBalance sb WHERE sb.warehouse.id = :warehouseId AND sb.product.id = :productId")
    Optional<StockBalance> findByWarehouseIdAndProductIdForUpdate(
            @Param("warehouseId") Long warehouseId,
            @Param("productId") Long productId
    );

    List<StockBalance> findByWarehouseId(Long warehouseId);

    List<StockBalance> findByProductId(Long productId);

    boolean existsByWarehouseId(Long warehouseId);

    boolean existsByProductId(Long productId);

    @Query("SELECT COALESCE(SUM(sb.quantity), 0) FROM StockBalance sb WHERE sb.product.id = :productId")
    BigDecimal getTotalEnterpriseStockForProduct(@Param("productId") Long productId);

    @Query("SELECT sb FROM StockBalance sb WHERE sb.warehouse.id = :warehouseId AND sb.quantity <= sb.product.minStockLevel")
    List<StockBalance> findLowStockInWarehouse(@Param("warehouseId") Long warehouseId);

    @Query("SELECT sb FROM StockBalance sb WHERE sb.quantity <= sb.product.minStockLevel")
    List<StockBalance> findAllLowStock();

    @Query("SELECT sb FROM StockBalance sb WHERE " +
            "(:warehouseId IS NULL OR sb.warehouse.id = :warehouseId) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(sb.product.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sb.product.sku) LIKE LOWER(CONCAT('%', :query, '%')) OR sb.product.barcode LIKE CONCAT('%', :query, '%'))")
    Page<StockBalance> searchBalances(
            @Param("warehouseId") Long warehouseId,
            @Param("query") String query,
            Pageable pageable
    );
}
