package com.nbh.erp.salesreturn.repository;

import com.nbh.erp.salesreturn.entity.SalesReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalesReturnRepository extends JpaRepository<SalesReturn, Long> {

    Optional<SalesReturn> findByReturnNumber(String returnNumber);
    @Query("select coalesce(sum(i.quantity),0) from SalesReturnItem i where i.invoiceItemId=:lineId and i.salesReturn.status='COMPLETED'")
    java.math.BigDecimal returnedQuantity(@Param("lineId") Long lineId);

    @Query("SELECT COALESCE(SUM(sr.totalAmount), 0) FROM SalesReturn sr WHERE sr.customer.id = :customerId AND sr.status = 'COMPLETED' AND (:startDate IS NULL OR sr.returnDate >= :startDate) AND (:endDate IS NULL OR sr.returnDate <= :endDate)")
    java.math.BigDecimal getCustomerReturnsBetween(@Param("customerId") Long customerId, @Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);


    @Query("SELECT sr FROM SalesReturn sr WHERE " +
            "(:warehouseId IS NULL OR sr.warehouse.id = :warehouseId) AND " +
            "(:customerId IS NULL OR sr.customer.id = :customerId) AND " +
            "(:status IS NULL OR sr.status = :status) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(sr.returnNumber) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sr.invoice.invoiceNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<SalesReturn> searchSalesReturns(
            @Param("warehouseId") Long warehouseId,
            @Param("customerId") Long customerId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );
}
