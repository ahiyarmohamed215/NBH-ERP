package com.nbh.erp.customertarget.repository;

import com.nbh.erp.customertarget.entity.CustomerTargetTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerTargetTierRepository extends JpaRepository<CustomerTargetTier, Long> {
    List<CustomerTargetTier> findByCustomerTargetIdOrderByTierLevelAsc(Long targetId);
    void deleteByCustomerTargetId(Long targetId);
}
