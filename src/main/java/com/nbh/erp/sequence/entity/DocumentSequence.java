package com.nbh.erp.sequence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_sequences", uniqueConstraints = {
        @UniqueConstraint(name = "uk_doc_type_year", columnNames = {"document_type", "year"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_type", nullable = false, length = 30)
    private String documentType; // INV, GRN, GTN, PRN, ADJ, RTN, CRN

    @Column(name = "prefix", nullable = false, length = 10)
    private String prefix;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "current_sequence", nullable = false)
    private Long currentSequence;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
