package com.nbh.erp.salesreturn.repository;
import com.nbh.erp.salesreturn.entity.CreditAllocation;
import org.springframework.data.jpa.repository.*;
public interface CreditAllocationRepository extends JpaRepository<CreditAllocation,Long> {
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select a from CreditAllocation a where a.id=:id") java.util.Optional<CreditAllocation> lockById(Long id);
 java.util.List<CreditAllocation> findByCreditNoteId(Long id);
}
