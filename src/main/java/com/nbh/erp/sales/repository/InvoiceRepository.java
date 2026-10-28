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
    List<Invoice> findByHeldBatchIdOrderByIdAsc(Long heldBatchId);
    @Query("select i from Invoice i where i.originalHeldSnapshot is not null order by i.originalHeldCapturedAt desc")
    List<Invoice> findWarehouseOriginals();

    @Query("select i from Invoice i where (i.originalHeldSentAt is not null and i.originalHeldTotal is not null and i.status not in ('CANCELLED','VOIDED') and not exists (select v.id from Invoice v where v.id=i.mergedInvoiceId and v.status='VOIDED')) and i.invoiceDate between :start and :end")
    List<Invoice> findPerformanceDocuments(@Param("start") LocalDate start,@Param("end") LocalDate end);

    @Query("select coalesce(sum(i.originalHeldTotal),0) from Invoice i where (i.originalHeldSentAt is not null and i.originalHeldTotal is not null and i.status not in ('CANCELLED','VOIDED') and not exists (select v.id from Invoice v where v.id=i.mergedInvoiceId and v.status='VOIDED')) and (:startDate is null or i.invoiceDate>=:startDate) and (:endDate is null or i.invoiceDate<=:endDate) and i.customer.id=:customerId")
    BigDecimal getCustomerPerformanceBetween(@Param("customerId") Long customerId,@Param("startDate") LocalDate startDate,@Param("endDate") LocalDate endDate);
    @Query("select coalesce(sum(i.originalHeldTotal),0) from Invoice i where (i.originalHeldSentAt is not null and i.originalHeldTotal is not null and i.status not in ('CANCELLED','VOIDED') and not exists (select v.id from Invoice v where v.id=i.mergedInvoiceId and v.status='VOIDED')) and (:startDate is null or i.invoiceDate>=:startDate) and (:endDate is null or i.invoiceDate<=:endDate) and i.salesRep.id=:salesmanId")
    BigDecimal getSalesmanPerformanceBetween(@Param("salesmanId") Long salesmanId,@Param("startDate") LocalDate startDate,@Param("endDate") LocalDate endDate);
    @Query("select coalesce(sum(i.originalHeldTotal),0) from Invoice i where (i.originalHeldSentAt is not null and i.originalHeldTotal is not null and i.status not in ('CANCELLED','VOIDED') and not exists (select v.id from Invoice v where v.id=i.mergedInvoiceId and v.status='VOIDED')) and (:startDate is null or i.invoiceDate>=:startDate) and (:endDate is null or i.invoiceDate<=:endDate)")
    BigDecimal getTotalPerformanceBetween(@Param("startDate") LocalDate startDate,@Param("endDate") LocalDate endDate);
    @Query("select count(i) from Invoice i where (i.originalHeldSentAt is not null and i.originalHeldTotal is not null and i.status not in ('CANCELLED','VOIDED') and not exists (select v.id from Invoice v where v.id=i.mergedInvoiceId and v.status='VOIDED')) and (:startDate is null or i.invoiceDate>=:startDate) and (:endDate is null or i.invoiceDate<=:endDate) and i.customer.id=:customerId")
    long countCustomerPerformanceBetween(@Param("customerId") Long customerId,@Param("startDate") LocalDate startDate,@Param("endDate") LocalDate endDate);

    java.util.List<Invoice> findByStatusIn(java.util.Collection<String> statuses);
    java.util.List<Invoice> findByStatusInAndCreatedBy(java.util.Collection<String> statuses,String createdBy);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Invoice e where e.id = :id")
    java.util.Optional<Invoice> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    Optional<Invoice> findByHeldNumber(String heldNumber);
    List<Invoice> findByMergedInvoiceId(Long mergedInvoiceId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.mergedInvoiceId=:id order by i.id")
    List<Invoice> lockMergedSources(@Param("id") Long id);
    @Query("select i.mergedInvoiceId from Invoice i where i.id=:id")
    Long findMergedParentId(@Param("id") Long id);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.invoiceNumber = :number or i.heldNumber = :number")
    Optional<Invoice> findByNumberForUpdate(@Param("number") String number);


    @Query("select coalesce(sum(i.balanceAmount),0) from Invoice i where i.customer.id=:customerId and i.status in ('COMPLETED','PARTIAL','PAID')")
    BigDecimal outstandingForCustomer(@Param("customerId") Long customerId);
    List<Invoice> findByStatus(String status);

    long countByStatus(String status);

    long countByStatusIn(java.util.Collection<String> statuses);

    @Query("SELECT i FROM Invoice i " +
           "LEFT JOIN FETCH i.customer " +
           "LEFT JOIN FETCH i.warehouse " +
           "WHERE i.customer.isActive = true AND i.invoiceNumber IS NOT NULL " +
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

    @Query("SELECT i FROM Invoice i WHERE i.customer.id = :customerId AND i.balanceAmount > 0 AND i.status IN ('COMPLETED','PARTIAL','PAID') ORDER BY i.createdAt DESC")
    List<Invoice> findOutstandingByCustomerId(@Param("customerId") Long customerId);

    @Query("SELECT i FROM Invoice i WHERE i.customer.isActive = true AND " +
            "i.status <> 'MERGED' AND (:warehouseId IS NULL OR i.warehouse.id = :warehouseId) AND " +
            "(:customerId IS NULL OR i.customer.id = :customerId) AND " +
            "((:status IS NULL AND i.invoiceNumber IS NOT NULL) OR " +
            " (:status = 'PAID' AND (i.status = 'PAID' OR i.balanceAmount = 0)) OR " +
            " (:status = 'PARTIAL' AND (i.status = 'PARTIAL' OR (i.paidAmount > 0 AND i.balanceAmount > 0))) OR " +
            " (:status = 'PENDING' AND (i.status = 'PENDING' OR (i.paidAmount = 0 AND i.balanceAmount > 0))) OR " +
            " (i.status = :status)) AND " +
            "(:paymentType IS NULL OR i.paymentType = :paymentType) AND " +
            "(:paymentMethod IS NULL OR :paymentMethod = '' OR UPPER(i.paymentMethod) = :paymentMethod OR UPPER(i.paymentType) = :paymentMethod) AND " +
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
            @Param("paymentMethod") String paymentMethod,
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

    @Query("SELECT COALESCE(SUM(i.netTotal), 0) AS totalSales, COUNT(i) AS orderCount " +
           "FROM Invoice i WHERE i.status IN ('COMPLETED','PAID','PARTIAL') AND i.invoiceDate = :date")
    TodaySalesSummary getTodaySalesSummary(@Param("date") LocalDate date);

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
            "FROM Invoice i WHERE i.status in ('HELD','YET_TO_PRINT','SENT_TO_WAREHOUSE','STOCK_ADJUSTED') " +
            "GROUP BY i.createdBy")
    List<CashierHeldProjection> getCashierHeldSummary();

    @Query("select i.createdBy as cashier, count(i) as heldCount, coalesce(sum(coalesce(i.originalHeldTotal, i.netTotal)),0) as totalHeld from Invoice i where i.heldNumber is not null and i.status not in ('CANCELLED','VOIDED') and i.invoiceDate between :start and :end and (:excludeId is null or i.id <> :excludeId) group by i.createdBy")
    List<CashierHeldProjection> getMonthlyHeldSummary(@Param("start") LocalDate start,@Param("end") LocalDate end,@Param("excludeId") Long excludeId);

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

    interface TodaySalesSummary {
        BigDecimal getTotalSales();
        Long getOrderCount();
    }
}

