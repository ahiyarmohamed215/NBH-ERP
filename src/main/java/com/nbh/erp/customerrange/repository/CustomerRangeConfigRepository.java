package com.nbh.erp.customerrange.repository;

import com.nbh.erp.customerrange.entity.CustomerRangeConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRangeConfigRepository extends JpaRepository<CustomerRangeConfig, Long> {

    List<CustomerRangeConfig> findAllByOrderByDisplayOrderAscMinSpendAsc();

    List<CustomerRangeConfig> findByIsActiveTrueOrderByMinSpendAsc();

    Optional<CustomerRangeConfig> findByRangeCode(String rangeCode);

    boolean existsByRangeCode(String rangeCode);

    boolean existsByMinSpend(BigDecimal minSpend);

    boolean existsByMinSpendAndIdNot(BigDecimal minSpend, Long id);

    @Query("SELECT r FROM CustomerRangeConfig r WHERE r.isActive = true AND r.minSpend <= :amount ORDER BY r.minSpend DESC")
    List<CustomerRangeConfig> findMatchingRangesDescending(BigDecimal amount);

    @Query("SELECT r FROM CustomerRangeConfig r WHERE r.isActive = true AND r.minSpend > :amount ORDER BY r.minSpend ASC")
    List<CustomerRangeConfig> findNextRangesAscending(BigDecimal amount);
}
