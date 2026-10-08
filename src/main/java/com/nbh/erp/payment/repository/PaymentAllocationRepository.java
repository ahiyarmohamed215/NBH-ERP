package com.nbh.erp.payment.repository;
import com.nbh.erp.payment.entity.PaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocation,Long> {
 List<PaymentAllocation> findByPaymentIdAndReversedFalse(Long id);
}
