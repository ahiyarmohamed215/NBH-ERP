package com.nbh.erp.sales.service;

import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.customerrange.service.CustomerRangeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;

/** Performance summaries update after printing commits; a report failure must not undo a printer result. */
@Component @RequiredArgsConstructor @Slf4j
public class HeldPerformanceListener {
    private final InvoiceRepository invoices;
    private final CustomerRangeService ranges;
    private final TransactionTemplate transactions;
    @TransactionalEventListener
    public void changed(HeldPerformanceChanged event) {
        var separate = new TransactionTemplate(transactions.getTransactionManager());
        separate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        try {
            separate.executeWithoutResult(tx -> invoices.findById(event.billId()).ifPresent(bill ->
                ranges.recalculateSummary(bill.getCustomer(),java.time.YearMonth.from(bill.getInvoiceDate()).toString(),null)));
        } catch (Exception e) {
            log.warn("Could not refresh range summary for held bill {}; the next progress read will recalculate it",event.billId(),e);
        }
    }
}
