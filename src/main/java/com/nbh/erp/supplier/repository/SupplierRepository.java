package com.nbh.erp.supplier.repository;

import com.nbh.erp.supplier.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Supplier s where s.id=:id")
    Optional<Supplier> findByIdForUpdate(@Param("id") Long id);
    Optional<Supplier> findBySupplierCode(String supplierCode);
    boolean existsBySupplierCode(String supplierCode);
    List<Supplier> findByIsActiveTrue();
    List<Supplier> findByDeletedAtIsNull(org.springframework.data.domain.Sort sort);
    List<Supplier> findByDeletedAtIsNotNullAndPurgedAtIsNullOrderByDeletedAtDesc();

    @Query("SELECT s FROM Supplier s WHERE s.deletedAt IS NULL AND (LOWER(s.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(s.supplierCode) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Supplier> searchSuppliers(@Param("query") String query);
}
