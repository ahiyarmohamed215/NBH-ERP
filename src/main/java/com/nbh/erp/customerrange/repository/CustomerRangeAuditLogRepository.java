package com.nbh.erp.customerrange.repository;

import com.nbh.erp.customerrange.entity.CustomerRangeAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerRangeAuditLogRepository extends JpaRepository<CustomerRangeAuditLog, Long> {

    List<CustomerRangeAuditLog> findTop50ByOrderByPerformedAtDesc();

    Page<CustomerRangeAuditLog> findAllByOrderByPerformedAtDesc(Pageable pageable);
}
