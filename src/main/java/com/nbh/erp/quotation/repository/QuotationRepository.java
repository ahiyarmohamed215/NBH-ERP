package com.nbh.erp.quotation.repository;

import com.nbh.erp.quotation.entity.Quotation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface QuotationRepository extends JpaRepository<Quotation, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Quotation e where e.id = :id")
    java.util.Optional<Quotation> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    Optional<Quotation> findByQuotationNumber(String quotationNumber);

    boolean existsByQuotationNumber(String quotationNumber);

    @Query("SELECT q FROM Quotation q " +
           "LEFT JOIN q.customer c " +
           "WHERE (:customerId IS NULL OR c.id = :customerId) " +
           "AND (:status IS NULL OR q.status = :status) " +
           "AND (:startDate IS NULL OR q.quotationDate >= :startDate) " +
           "AND (:endDate IS NULL OR q.quotationDate <= :endDate) " +
           "AND (:query IS NULL OR (" +
           "   LOWER(q.quotationNumber) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "   LOWER(q.customerName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "   LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ")) " +
           "ORDER BY q.quotationDate DESC, q.id DESC")
    Page<Quotation> searchQuotations(
            @Param("customerId") Long customerId,
            @Param("status") String status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("query") String query,
            Pageable pageable
    );
}
