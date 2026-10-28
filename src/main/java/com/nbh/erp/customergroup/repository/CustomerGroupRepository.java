package com.nbh.erp.customergroup.repository;

import com.nbh.erp.customergroup.entity.CustomerGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerGroupRepository extends JpaRepository<CustomerGroup, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select g from CustomerGroup g where g.id=:id")
    Optional<CustomerGroup> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
    Optional<CustomerGroup> findByGroupCode(String groupCode);
    boolean existsByGroupCode(String groupCode);
    List<CustomerGroup> findByIsActiveTrue();
}
