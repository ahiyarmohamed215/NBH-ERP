package com.nbh.erp.customergroup.repository;

import com.nbh.erp.customergroup.entity.CustomerGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerGroupRepository extends JpaRepository<CustomerGroup, Long> {
    Optional<CustomerGroup> findByGroupCode(String groupCode);
    boolean existsByGroupCode(String groupCode);
    List<CustomerGroup> findByIsActiveTrue();
}
