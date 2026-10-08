package com.nbh.erp.accounting.repository;
import com.nbh.erp.accounting.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AccountRepository extends JpaRepository<Account,String> {
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select a from Account a where a.code='CASH'") java.util.Optional<Account> postingLock();
}
