package com.nbh.erp.accounting.repository;
import com.nbh.erp.accounting.entity.Journal;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import java.util.*;
import java.time.LocalDate;
public interface JournalRepository extends JpaRepository<Journal,Long> {
 Optional<Journal> findBySource(String source);
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select j from Journal j where j.id=:id") Optional<Journal> lockById(Long id);
 @Query("select j from Journal j where (:kind is null or j.kind=:kind) order by j.id desc") Page<Journal> search(String kind,Pageable page);
 @Query("select l.account.code, l.account.name, l.account.type, sum(l.debit), sum(l.credit) from JournalLine l where (:start is null or l.journal.postingDate>=:start) and (:end is null or l.journal.postingDate<=:end) group by l.account.code,l.account.name,l.account.type order by l.account.code")
 List<Object[]> trialBalance(LocalDate start,LocalDate end);
}
