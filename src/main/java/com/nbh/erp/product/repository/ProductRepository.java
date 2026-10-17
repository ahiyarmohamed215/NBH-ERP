package com.nbh.erp.product.repository;

import com.nbh.erp.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends com.nbh.erp.common.repository.RecyclableRepository<Product> {

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.id = :id AND p.deletedAt IS NULL")
    Optional<Product> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.sku = :sku AND p.deletedAt IS NULL")
    Optional<Product> findBySku(@Param("sku") String sku);

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.barcode = :barcode AND p.deletedAt IS NULL")
    Optional<Product> findByBarcode(@Param("barcode") String barcode);

    boolean existsBySku(String sku);

    boolean existsByBarcode(String barcode);

    boolean existsByCategoryId(Long categoryId);

    boolean existsByDefaultSupplierId(Long supplierId);

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.deletedAt IS NULL AND p.isActive = true")
    List<Product> findByIsActiveTrue();

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.deletedAt IS NULL AND p.isActive = true AND p.category.id = :categoryId")
    List<Product> findByCategoryIdAndIsActiveTrue(@Param("categoryId") Long categoryId);

    @Query("SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.deletedAt IS NULL AND p.isActive = true AND (" +
            "LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR p.barcode = :query)")
    List<Product> searchActiveProducts(@Param("query") String query);

    @Query(value = "SELECT p FROM Product p " +
            "LEFT JOIN FETCH p.category " +
            "LEFT JOIN FETCH p.brand " +
            "LEFT JOIN FETCH p.defaultSupplier " +
            "LEFT JOIN FETCH p.defaultWarehouse " +
            "WHERE p.deletedAt IS NULL AND " +
            "(:query IS NULL OR :query = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) OR p.barcode LIKE CONCAT('%', :query, '%')) " +
            "AND (:categoryId IS NULL OR p.category.id = :categoryId)",
            countQuery = "SELECT COUNT(p) FROM Product p WHERE p.deletedAt IS NULL AND " +
            "(:query IS NULL OR :query = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) OR p.barcode LIKE CONCAT('%', :query, '%')) " +
            "AND (:categoryId IS NULL OR p.category.id = :categoryId)")
    Page<Product> searchPaginated(
            @Param("query") String query,
            @Param("categoryId") Long categoryId,
            Pageable pageable
    );
}
