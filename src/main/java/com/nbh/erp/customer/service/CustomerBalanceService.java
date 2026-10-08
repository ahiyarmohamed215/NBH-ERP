package com.nbh.erp.customer.service;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @RequiredArgsConstructor
public class CustomerBalanceService {
 private final CustomerRepository customers;
 private final InvoiceRepository invoices;
 @Transactional public void reconcile(Long customerId) {
  var customer=customers.findByIdForUpdate(customerId).orElseThrow();
  invoices.flush();
  customer.setCurrentBalance(invoices.outstandingForCustomer(customerId));
  customers.save(customer);
 }
}
