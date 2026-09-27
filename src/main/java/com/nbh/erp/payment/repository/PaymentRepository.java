package com.nbh.erp.payment.repository;

import com.nbh.erp.payment.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByPaymentNumber(String paymentNumber);

    List<Payment> findByInvoiceId(Long invoiceId);

    List<Payment> findByCustomerId(Long customerId);

    @Query("SELECT p FROM Payment p " +
           "LEFT JOIN p.customer c " +
           "LEFT JOIN p.invoice i " +
           "WHERE (:customerId IS NULL OR c.id = :customerId) " +
           "AND (:invoiceId IS NULL OR i.id = :invoiceId) " +
           "AND (:paymentMethod IS NULL OR p.paymentMethod = :paymentMethod) " +
           "AND (:status IS NULL OR p.status = :status) " +
           "AND (:startDate IS NULL OR p.paymentDate >= :startDate) " +
           "AND (:endDate IS NULL OR p.paymentDate <= :endDate) " +
           "AND (:query IS NULL OR (" +
           "   LOWER(p.paymentNumber) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "   LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "   LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "   LOWER(p.referenceNumber) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ")) " +
           "ORDER BY p.paymentDate DESC, p.id DESC")
    Page<Payment> searchPayments(
            @Param("customerId") Long customerId,
            @Param("invoiceId") Long invoiceId,
            @Param("paymentMethod") String paymentMethod,
            @Param("status") String status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("query") String query,
            Pageable pageable
    );
}
