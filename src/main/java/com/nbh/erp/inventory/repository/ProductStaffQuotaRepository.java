package com.nbh.erp.inventory.repository;

import com.nbh.erp.inventory.entity.ProductStaffQuota;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductStaffQuotaRepository extends com.nbh.erp.common.repository.RecyclableRepository<ProductStaffQuota> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from ProductStaffQuota q where q.id = :id and q.deletedAt is null")
    Optional<ProductStaffQuota> findByIdForUpdate(@Param("id") Long id);


    @Query("SELECT q FROM ProductStaffQuota q WHERE q.product.id = :productId AND q.user.id = :userId " +
           "AND (:warehouseId IS NULL OR q.warehouse.id = :warehouseId OR q.warehouse IS NULL) " +
           "AND q.isActive = true " +
           "ORDER BY CASE WHEN q.warehouse.id = :warehouseId THEN 1 ELSE 2 END")
    List<ProductStaffQuota> findMatchingActiveQuotas(
            @Param("productId") Long productId,
            @Param("userId") Long userId,
            @Param("warehouseId") Long warehouseId
    );

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM ProductStaffQuota q WHERE q.product.id = :productId AND q.user.id = :userId " +
           "AND (:warehouseId IS NULL OR q.warehouse.id = :warehouseId OR q.warehouse IS NULL) " +
           "AND q.isActive = true " +
           "ORDER BY CASE WHEN q.warehouse.id = :warehouseId THEN 1 ELSE 2 END")
    List<ProductStaffQuota> lockMatchingActiveQuotas(
            @Param("productId") Long productId,
            @Param("userId") Long userId,
            @Param("warehouseId") Long warehouseId
    );

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<ProductStaffQuota> findByProductIdAndUserIdAndWarehouseId(Long productId, Long userId, Long warehouseId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<ProductStaffQuota> findByProductIdAndUserIdAndWarehouseIsNull(Long productId, Long userId);

    List<ProductStaffQuota> findByProductId(Long productId);

    List<ProductStaffQuota> findByUserId(Long userId);

    @Query("SELECT q FROM ProductStaffQuota q LEFT JOIN q.product p LEFT JOIN q.user u LEFT JOIN q.warehouse w WHERE " +
           "q.deletedAt IS NULL AND (:productId IS NULL OR p.id = :productId) AND " +
           "(:userId IS NULL OR u.id = :userId) AND " +
           "(:warehouseId IS NULL OR w.id = :warehouseId) AND " +
           "(:activeOnly IS NULL OR q.isActive = :activeOnly) AND " +
           "(:query IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(q.notes) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<ProductStaffQuota> searchQuotas(
            @Param("productId") Long productId,
            @Param("userId") Long userId,
            @Param("warehouseId") Long warehouseId,
            @Param("activeOnly") Boolean activeOnly,
            @Param("query") String query,
            Pageable pageable
    );

    @Query("SELECT COUNT(q) FROM ProductStaffQuota q WHERE q.isActive = true")
    long countActiveQuotas();

    @Query("SELECT COUNT(q) FROM ProductStaffQuota q WHERE q.isActive = true AND q.soldQuantity >= q.allocatedQuantity")
    long countExhaustedQuotas();

    @Query("SELECT COUNT(DISTINCT q.product.id) FROM ProductStaffQuota q WHERE q.isActive = true")
    long countDistinctRestrictedProducts();

    @Query("SELECT COUNT(DISTINCT q.user.id) FROM ProductStaffQuota q WHERE q.isActive = true")
    long countDistinctRestrictedStaff();
}
