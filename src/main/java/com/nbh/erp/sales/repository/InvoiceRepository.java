package com.nbh.erp.sales.repository;

import com.nbh.erp.sales.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    List<Invoice> findByStatus(String status);

    List<Invoice> findByStatusAndCreatedBy(String status, String createdBy);

    @Query("SELECT i FROM Invoice i WHERE " +
            "(:warehouseId IS NULL OR i.warehouse.id = :warehouseId) AND " +
            "(:customerId IS NULL OR i.customer.id = :customerId) AND " +
            "(:status IS NULL OR i.status = :status) AND " +
            "(:paymentType IS NULL OR i.paymentType = :paymentType) AND " +
            "(:startDate IS NULL OR i.invoiceDate >= :startDate) AND " +
            "(:endDate IS NULL OR i.invoiceDate <= :endDate) AND " +
            "(:createdBy IS NULL OR i.createdBy = :createdBy) AND " +
            "(:query IS NULL OR :query = '' OR LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(i.customer.name) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Invoice> searchInvoices(
            @Param("warehouseId") Long warehouseId,
            @Param("customerId") Long customerId,
            @Param("status") String status,
            @Param("paymentType") String paymentType,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("createdBy") String createdBy,
            @Param("query") String query,
            Pageable pageable
    );

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.status = 'COMPLETED' AND i.invoiceDate = :date")
    BigDecimal getTotalSalesForDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.status = 'COMPLETED' AND i.invoiceDate BETWEEN :startDate AND :endDate")
    BigDecimal getTotalSalesBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.status = 'COMPLETED' AND i.invoiceDate = :date")
    long countCompletedInvoicesForDate(@Param("date") LocalDate date);

    @Query("SELECT i.createdBy AS cashier, COUNT(i) AS invoiceCount, COALESCE(SUM(i.netTotal), 0) AS totalSales, MAX(i.invoiceDate) AS lastSaleDate " +
            "FROM Invoice i WHERE i.status = 'COMPLETED' " +
            "AND (:startDate IS NULL OR i.invoiceDate >= :startDate) " +
            "AND (:endDate IS NULL OR i.invoiceDate <= :endDate) " +
            "GROUP BY i.createdBy")
    List<CashierSalesProjection> getCashierSalesSummary(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("SELECT i.createdBy AS cashier, COUNT(i) AS heldCount, COALESCE(SUM(i.netTotal), 0) AS totalHeld " +
            "FROM Invoice i WHERE i.status = 'HELD' " +
            "GROUP BY i.createdBy")
    List<CashierHeldProjection> getCashierHeldSummary();

    interface CashierSalesProjection {
        String getCashier();
        Long getInvoiceCount();
        BigDecimal getTotalSales();
        LocalDate getLastSaleDate();
    }

    interface CashierHeldProjection {
        String getCashier();
        Long getHeldCount();
        BigDecimal getTotalHeld();
    }
}

