package com.nbh.erp.sequence.service;

import com.nbh.erp.sequence.entity.DocumentSequence;
import com.nbh.erp.sequence.repository.DocumentSequenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentSequenceService {

    private final DocumentSequenceRepository sequenceRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public synchronized String getNextNumber(String documentType) {
        int currentYear = LocalDate.now().getYear();
        
        DocumentSequence sequence = sequenceRepository.findByDocumentTypeAndYearForUpdate(documentType, currentYear)
                .orElseGet(() -> {
                    String prefix = documentType.toUpperCase() + "-" + currentYear + "-";
                    DocumentSequence newSeq = DocumentSequence.builder()
                            .documentType(documentType.toUpperCase())
                            .prefix(prefix)
                            .year(currentYear)
                            .currentSequence(0L)
                            .build();
                    return sequenceRepository.save(newSeq);
                });

        long nextVal = sequence.getCurrentSequence() + 1;
        sequence.setCurrentSequence(nextVal);
        sequenceRepository.save(sequence);

        // Format: INV-2026-000001
        return String.format("%s%06d", sequence.getPrefix(), nextVal);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateInvoiceNumber() {
        return getNextNumber("INV");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateGrnNumber() {
        return getNextNumber("GRN");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateGtnNumber() {
        return getNextNumber("GTN");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generatePrnNumber() {
        return getNextNumber("PRN");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateAdjustmentNumber() {
        return getNextNumber("ADJ");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateReturnNumber() {
        return getNextNumber("RTN");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateCreditNoteNumber() {
        return getNextNumber("CRN");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generatePaymentNumber() {
        return getNextNumber("REC");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateQuotationNumber() {
        return getNextNumber("QT");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateAdvanceVoucherNumber() {
        return getNextNumber("ADV");
    }
}

