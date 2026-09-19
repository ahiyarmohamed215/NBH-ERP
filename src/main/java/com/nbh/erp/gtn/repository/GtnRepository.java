package com.nbh.erp.gtn.repository;

import com.nbh.erp.gtn.entity.Gtn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GtnRepository extends JpaRepository<Gtn, Long> {

    Optional<Gtn> findByGtnNumber(String gtnNumber);

    @Query("SELECT g FROM Gtn g WHERE " +
            "(:sourceWarehouseId IS NULL OR g.sourceWarehouse.id = :sourceWarehouseId) AND " +
            "(:destinationWarehouseId IS NULL OR g.destinationWarehouse.id = :destinationWarehouseId) AND " +
            "(:status IS NULL OR g.status = :status) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(g.gtnNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Gtn> searchGtns(
            @Param("sourceWarehouseId") Long sourceWarehouseId,
            @Param("destinationWarehouseId") Long destinationWarehouseId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );
}
