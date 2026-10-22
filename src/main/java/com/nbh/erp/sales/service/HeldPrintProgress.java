package com.nbh.erp.sales.service;

import com.nbh.erp.sales.entity.*;
import com.nbh.erp.sales.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class HeldPrintProgress {
    private final InvoiceRepository invoices;
    private final java.time.Clock clock;
    private final org.springframework.context.ApplicationEventPublisher events;

    @Transactional
    public void reconcile(Long billId){
        var bill=invoices.findByIdForUpdate(billId).orElseThrow();
        reconcile(bill);
    }
    public void reconcile(Invoice bill){
        if("YET_TO_PRINT".equals(bill.getStatus())){
            bill.setStatus("SENT_TO_WAREHOUSE");
            if(bill.getOriginalHeldSnapshot()!=null && bill.getOriginalHeldSentAt()==null)
                bill.setOriginalHeldSentAt(java.time.LocalDateTime.now(clock));
            invoices.saveAndFlush(bill);
            events.publishEvent(new HeldPerformanceChanged(bill.getId()));
        }
    }
}
