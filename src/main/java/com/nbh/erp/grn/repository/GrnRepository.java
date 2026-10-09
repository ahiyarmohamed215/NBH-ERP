package com.nbh.erp.grn.repository;

import com.nbh.erp.grn.entity.Grn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GrnRepository extends JpaRepository<Grn, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Grn e where e.id = :id")
    java.util.Optional<Grn> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    Optional<Grn> findByGrnNumber(String grnNumber);

    boolean existsByWarehouseId(Long warehouseId);

    boolean existsBySupplierId(Long supplierId);

    @Query("SELECT g FROM Grn g WHERE " +
            "(:warehouseId IS NULL OR g.warehouse.id = :warehouseId) AND " +
            "(:supplierId IS NULL OR g.supplier.id = :supplierId) AND " +
            "(:status IS NULL OR g.status = :status) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(g.grnNumber) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(g.supplierInvoiceNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Grn> searchGrns(
            @Param("warehouseId") Long warehouseId,
            @Param("supplierId") Long supplierId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );

    @Query("SELECT DISTINCT g FROM Grn g " +
           "LEFT JOIN FETCH g.supplier " +
           "LEFT JOIN FETCH g.warehouse " +
           "ORDER BY g.createdAt DESC")
    java.util.List<Grn> findRecentGrns(Pageable pageable);
}
