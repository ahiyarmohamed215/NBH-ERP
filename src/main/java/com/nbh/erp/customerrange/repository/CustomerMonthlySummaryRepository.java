package com.nbh.erp.customerrange.repository;

import com.nbh.erp.customerrange.entity.CustomerMonthlySummary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerMonthlySummaryRepository extends JpaRepository<CustomerMonthlySummary, Long> {

    Optional<CustomerMonthlySummary> findByCustomerIdAndYearMonth(Long customerId, String yearMonth);

    List<CustomerMonthlySummary> findByCustomerIdOrderByYearMonthDesc(Long customerId);

    @Query("SELECT COUNT(s) FROM CustomerMonthlySummary s WHERE s.yearMonth = :yearMonth AND s.currentRange.id = :rangeId")
    long countByYearMonthAndCurrentRangeId(@Param("yearMonth") String yearMonth, @Param("rangeId") Long rangeId);

    @Query("SELECT COUNT(s) FROM CustomerMonthlySummary s WHERE s.yearMonth = :yearMonth AND s.qualifyingPurchases > 0")
    long countActivePurchasersByYearMonth(@Param("yearMonth") String yearMonth);

    @Query("SELECT COALESCE(SUM(s.qualifyingPurchases), 0) FROM CustomerMonthlySummary s WHERE s.yearMonth = :yearMonth")
    BigDecimal getTotalQualifyingSalesByYearMonth(@Param("yearMonth") String yearMonth);

    @Query("SELECT s FROM CustomerMonthlySummary s WHERE s.yearMonth = :yearMonth " +
            "AND (:rangeId IS NULL OR s.currentRange.id = :rangeId) " +
            "AND (:staffId IS NULL OR s.assignedStaff.id = :staffId) " +
            "AND (:search IS NULL OR :search = '' OR " +
            "     LOWER(s.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "     LOWER(s.customer.customerCode) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "     LOWER(s.customer.phone) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<CustomerMonthlySummary> searchMonthlySummaries(
            @Param("yearMonth") String yearMonth,
            @Param("rangeId") Long rangeId,
            @Param("staffId") Long staffId,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT s FROM CustomerMonthlySummary s WHERE s.yearMonth = :yearMonth " +
            "AND s.assignedStaff.id = :staffId " +
            "AND (:rangeId IS NULL OR s.currentRange.id = :rangeId) " +
            "AND (:search IS NULL OR :search = '' OR " +
            "     LOWER(s.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "     LOWER(s.customer.customerCode) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "     LOWER(s.customer.phone) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<CustomerMonthlySummary> findByStaffAndMonth(
            @Param("staffId") Long staffId,
            @Param("yearMonth") String yearMonth,
            @Param("rangeId") Long rangeId,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT s.assignedStaff.id AS staffId, " +
            "s.assignedStaff.fullName AS staffName, " +
            "s.assignedStaff.username AS staffUsername, " +
            "COUNT(s) AS totalAssignedCustomers, " +
            "SUM(CASE WHEN s.qualifyingPurchases > 0 THEN 1 ELSE 0 END) AS activePurchasingCustomers, " +
            "SUM(CASE WHEN s.currentRange.minSpend > 0 THEN 1 ELSE 0 END) AS promotedCustomers, " +
            "COALESCE(SUM(s.qualifyingPurchases), 0) AS totalQualifyingPurchases " +
            "FROM CustomerMonthlySummary s " +
            "WHERE s.yearMonth = :yearMonth AND s.assignedStaff IS NOT NULL " +
            "GROUP BY s.assignedStaff.id, s.assignedStaff.fullName, s.assignedStaff.username")
    List<StaffPerformanceProjection> getStaffPerformanceForMonth(@Param("yearMonth") String yearMonth);

    interface StaffPerformanceProjection {
        Long getStaffId();
        String getStaffName();
        String getStaffUsername();
        Long getTotalAssignedCustomers();
        Long getActivePurchasingCustomers();
        Long getPromotedCustomers();
        BigDecimal getTotalQualifyingPurchases();
    }
}
