package com.nbh.erp.sequence.repository;

import com.nbh.erp.sequence.entity.DocumentSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DocumentSequenceRepository extends JpaRepository<DocumentSequence, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DocumentSequence d WHERE d.documentType = :docType AND d.year = :year")
    Optional<DocumentSequence> findByDocumentTypeAndYearForUpdate(
            @Param("docType") String documentType,
            @Param("year") Integer year
    );
}
