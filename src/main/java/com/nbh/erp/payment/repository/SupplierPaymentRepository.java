package com.nbh.erp.payment.repository;
import com.nbh.erp.payment.entity.SupplierPayment;
import org.springframework.data.jpa.repository.*;
import java.math.BigDecimal;
public interface SupplierPaymentRepository extends JpaRepository<SupplierPayment,Long> {
 @Query("select coalesce(sum(p.amount),0) from SupplierPayment p where p.grn.id=:id and p.reversed=false") BigDecimal totalPaid(Long id);
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select p from SupplierPayment p where p.id=:id") java.util.Optional<SupplierPayment> lockById(Long id);
}
