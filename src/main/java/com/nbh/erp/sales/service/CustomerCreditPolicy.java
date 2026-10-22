package com.nbh.erp.sales.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class CustomerCreditPolicy {
    private final CustomerRepository customers;
    private final InvoiceRepository invoices;

    /** Customer lock serializes billing with other bills and payment reconciliation. */
    @Transactional
    public void validate(Long customerId, BigDecimal additionalBalance, BigDecimal ownPostedBalance) {
        var customer = customers.findByIdForUpdate(customerId).orElseThrow();
        BigDecimal limit = customer.getCreditLimit() == null ? BigDecimal.ZERO : customer.getCreditLimit();
        if(limit.signum()<=0)return; // A missing or zero limit means unrestricted credit.
        BigDecimal outstanding = invoices.outstandingForCustomer(customerId).subtract(ownPostedBalance).max(BigDecimal.ZERO);
        if (outstanding.signum() > 0 && outstanding.compareTo(limit) >= 0)
            throw new BusinessException("Customer credit limit reached. Settle outstanding payments or increase the credit limit before further billing.");
        if (additionalBalance.signum() > 0 && outstanding.add(additionalBalance).compareTo(limit) > 0)
            throw new BusinessException("This bill exceeds the customer's available credit of Rs. " + limit.subtract(outstanding).max(BigDecimal.ZERO).setScale(2).toPlainString() + ". Settle outstanding payments or increase the credit limit before billing.");
    }
}
