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
public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findBySku(String sku);

    Optional<Product> findByBarcode(String barcode);

    boolean existsBySku(String sku);

    boolean existsByBarcode(String barcode);

    boolean existsByCategoryId(Long categoryId);

    boolean existsByDefaultSupplierId(Long supplierId);

    List<Product> findByIsActiveTrue();

    List<Product> findByCategoryIdAndIsActiveTrue(Long categoryId);

    @Query("SELECT p FROM Product p WHERE p.isActive = true AND (" +
            "LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR p.barcode = :query)")
    List<Product> searchActiveProducts(@Param("query") String query);

    @Query("SELECT p FROM Product p WHERE " +
            "(:query IS NULL OR :query = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) OR p.barcode LIKE CONCAT('%', :query, '%')) " +
            "AND (:categoryId IS NULL OR p.category.id = :categoryId)")
    Page<Product> searchPaginated(
            @Param("query") String query,
            @Param("categoryId") Long categoryId,
            Pageable pageable
    );
}
