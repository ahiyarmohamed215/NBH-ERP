package com.nbh.erp.customertarget.repository;

import com.nbh.erp.customertarget.entity.CustomerTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerTargetRepository extends JpaRepository<CustomerTarget, Long> {

    Optional<CustomerTarget> findByTargetCode(String targetCode);

    List<CustomerTarget> findByIsActiveTrue();

    List<CustomerTarget> findByCustomerIdAndIsActiveTrue(Long customerId);

    List<CustomerTarget> findBySalesmanIdAndIsActiveTrue(Long salesmanId);

    @Query("SELECT t FROM CustomerTarget t LEFT JOIN FETCH t.tiers WHERE t.id = :id")
    Optional<CustomerTarget> findByIdWithTiers(@Param("id") Long id);

    @Query("SELECT DISTINCT t FROM CustomerTarget t LEFT JOIN FETCH t.tiers " +
           "WHERE t.isActive = true " +
           "AND (:today BETWEEN t.startDate AND t.endDate) " +
           "AND (t.customer.id = :customerId " +
           "     OR (t.customer IS NULL AND t.customerGroup.id IN :groupIds) " +
           "     OR (t.customer IS NULL AND t.customerGroup IS NULL))")
    List<CustomerTarget> findActiveTargetsForCustomer(
            @Param("customerId") Long customerId,
            @Param("groupIds") List<Long> groupIds,
            @Param("today") LocalDate today
    );

    @Query("SELECT DISTINCT t FROM CustomerTarget t LEFT JOIN FETCH t.tiers " +
           "WHERE t.isActive = true " +
           "AND (:today BETWEEN t.startDate AND t.endDate) " +
           "AND (t.customer.id = :customerId " +
           "     OR (t.customer IS NULL AND t.customerGroup IS NULL))")
    List<CustomerTarget> findActiveTargetsForCustomerWithoutGroups(
            @Param("customerId") Long customerId,
            @Param("today") LocalDate today
    );

    @Query("SELECT DISTINCT t FROM CustomerTarget t LEFT JOIN FETCH t.tiers ORDER BY t.createdAt DESC")
    List<CustomerTarget> findAllWithTiers();
}
