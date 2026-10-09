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
    java.util.List<Invoice> findByStatusIn(java.util.Collection<String> statuses);
    java.util.List<Invoice> findByStatusInAndCreatedBy(java.util.Collection<String> statuses,String createdBy);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Invoice e where e.id = :id")
    java.util.Optional<Invoice> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.invoiceNumber = :number")
    Optional<Invoice> findByNumberForUpdate(@Param("number") String number);


    @Query("select coalesce(sum(i.balanceAmount),0) from Invoice i where i.customer.id=:customerId and i.status in ('COMPLETED','PARTIAL','PAID')")
    BigDecimal outstandingForCustomer(@Param("customerId") Long customerId);
    List<Invoice> findByStatus(String status);

    long countByStatus(String status);

    long countByStatusIn(java.util.Collection<String> statuses);

    @Query("SELECT DISTINCT i FROM Invoice i " +
           "LEFT JOIN FETCH i.customer " +
           "LEFT JOIN FETCH i.warehouse " +
           "LEFT JOIN FETCH i.salesRep " +
           "ORDER BY i.createdAt DESC")
    List<Invoice> findRecentInvoices(Pageable pageable);

    @Query("SELECT DISTINCT i FROM Invoice i " +
           "LEFT JOIN FETCH i.customer " +
           "WHERE i.status IN :statuses AND i.invoiceDate BETWEEN :startDate AND :endDate " +
           "ORDER BY i.invoiceDate ASC")
    List<Invoice> findByStatusInAndDateBetween(
            @Param("statuses") java.util.Collection<String> statuses,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    List<Invoice> findByStatusAndCreatedBy(String status, String createdBy);

    boolean existsByWarehouseId(Long warehouseId);

    boolean existsByCustomerId(Long customerId);

    List<Invoice> findByCustomerId(Long customerId);

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

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.status IN ('COMPLETED','PAID','PARTIAL') AND i.invoiceDate = :date")
    BigDecimal getTotalSalesForDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.status IN ('COMPLETED','PAID','PARTIAL') AND i.invoiceDate BETWEEN :startDate AND :endDate")
    BigDecimal getTotalSalesBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.customer.id = :customerId AND i.status IN ('COMPLETED','PAID','PARTIAL') AND (:startDate IS NULL OR i.invoiceDate >= :startDate) AND (:endDate IS NULL OR i.invoiceDate <= :endDate)")
    BigDecimal getCustomerSalesBetween(@Param("customerId") Long customerId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.customer.id = :customerId AND i.status IN ('COMPLETED','PAID','PARTIAL') AND (:startDate IS NULL OR i.invoiceDate >= :startDate) AND (:endDate IS NULL OR i.invoiceDate <= :endDate)")
    long countCustomerInvoicesBetween(@Param("customerId") Long customerId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) FROM Invoice i WHERE i.salesRep.id = :salesmanId AND i.status IN ('COMPLETED','PAID','PARTIAL') AND (:startDate IS NULL OR i.invoiceDate >= :startDate) AND (:endDate IS NULL OR i.invoiceDate <= :endDate)")
    BigDecimal getSalesmanSalesBetween(@Param("salesmanId") Long salesmanId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.status IN ('COMPLETED','PAID','PARTIAL') AND i.invoiceDate = :date")
    long countCompletedInvoicesForDate(@Param("date") LocalDate date);

    @Query("SELECT i.createdBy AS cashier, COUNT(i) AS invoiceCount, COALESCE(SUM(i.netTotal), 0) AS totalSales, MAX(i.invoiceDate) AS lastSaleDate " +
            "FROM Invoice i WHERE i.status IN ('COMPLETED','PAID','PARTIAL') " +
            "AND (:startDate IS NULL OR i.invoiceDate >= :startDate) " +
            "AND (:endDate IS NULL OR i.invoiceDate <= :endDate) " +
            "GROUP BY i.createdBy")
    List<CashierSalesProjection> getCashierSalesSummary(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("SELECT i.createdBy AS cashier, COUNT(i) AS heldCount, COALESCE(SUM(i.netTotal), 0) AS totalHeld " +
            "FROM Invoice i WHERE i.status in ('HELD','SENT_TO_WAREHOUSE','STOCK_ADJUSTED') " +
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

