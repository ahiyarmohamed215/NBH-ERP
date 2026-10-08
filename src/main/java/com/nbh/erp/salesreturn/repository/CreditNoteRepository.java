package com.nbh.erp.salesreturn.repository;

import com.nbh.erp.salesreturn.entity.CreditNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CreditNoteRepository extends JpaRepository<CreditNote, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from CreditNote c where c.id=:id")
    Optional<CreditNote> lockById(Long id);
    Optional<CreditNote> findByCreditNoteNumber(String creditNoteNumber);
    Page<CreditNote> findByCustomerId(Long customerId, Pageable pageable);
}
