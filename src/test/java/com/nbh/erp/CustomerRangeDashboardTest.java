package com.nbh.erp;

import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.customerrange.service.CustomerRangeService;
import com.nbh.erp.common.exception.BusinessException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import java.math.BigDecimal;
import java.time.YearMonth;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class CustomerRangeDashboardTest {
 @Autowired CustomerRangeService service;
 @Autowired EntityManager em;
 @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
 @Test void dashboardPersistsMonthlySummariesAndSynchronizationRecalculatesExistingTotals(){
  var month=YearMonth.parse(service.getCurrentYearMonth());
  var customer=Customer.builder().customerCode("RANGE-LOAD-TEST").name("Range dashboard customer").isActive(true).build();em.persist(customer);
  var warehouse=Warehouse.builder().code("RANGE-TEST-WH").name("Warehouse").build();em.persist(warehouse);
  var invoice=Invoice.builder().invoiceNumber("RANGE-COMPLETED").customer(customer).warehouse(warehouse).invoiceDate(month.atDay(1)).netTotal(new BigDecimal("100000")).originalHeldTotal(new BigDecimal("100000")).originalHeldSentAt(month.atDay(1).atStartOfDay()).status("COMPLETED").build();em.persist(invoice);
  em.persist(Invoice.builder().invoiceNumber("RANGE-HELD").customer(customer).warehouse(warehouse).invoiceDate(month.atDay(1)).netTotal(new BigDecimal("200000")).status("HELD").build());em.flush();
  var dashboard=service.getManagerDashboard(month.toString(),null,null,"RANGE-LOAD-TEST",PageRequest.of(0,25));em.flush();
  assertEquals(1,dashboard.getCustomers().size());
  var progress=dashboard.getCustomers().getFirst();assertEquals(customer.getId(),progress.getCustomerId());
  assertEquals(0,new BigDecimal("100000").compareTo(progress.getMonthlyPurchases()));assertEquals("RANGE_1",progress.getCurrentRangeCode());
  assertEquals(0,new BigDecimal("50000").compareTo(progress.getRemainingAmount()));
  invoice.setNetTotal(new BigDecimal("120000"));invoice.setOriginalHeldTotal(new BigDecimal("120000"));em.flush();service.synchronizeMonth(month.toString());em.flush();
  var refreshed=service.getManagerDashboard(month.toString(),null,null,"RANGE-LOAD-TEST",PageRequest.of(0,25)).getCustomers().getFirst();
  assertEquals(0,new BigDecimal("120000").compareTo(refreshed.getMonthlyPurchases()));assertEquals(0,new BigDecimal("30000").compareTo(refreshed.getRemainingAmount()));
  invoice.setStatus("CANCELLED");em.flush();service.synchronizeMonth(month.toString());em.flush();
  assertEquals("RANGE_0",service.getManagerDashboard(month.toString(),null,null,"RANGE-LOAD-TEST",PageRequest.of(0,25)).getCustomers().getFirst().getCurrentRangeCode());
 }
 @Test void invalidSyncMonthIsRejected(){assertThrows(BusinessException.class,()->service.synchronizeMonth("invalid-month"));}
 @Test @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
 void concurrentDashboardLoadsCreateOnlyOneSummary() throws Exception {
  var tx=new org.springframework.transaction.support.TransactionTemplate(transactions);
  Long customerId=tx.execute(status->{var c=Customer.builder().customerCode("RANGE-CONCURRENT").name("Concurrent dashboard customer").build();em.persist(c);service.getActiveRanges();em.flush();return c.getId();});
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   var start=new java.util.concurrent.CountDownLatch(1);
   java.util.concurrent.Callable<Long> load=()->{start.await();return service.getManagerDashboard(service.getCurrentYearMonth(),null,null,"RANGE-CONCURRENT",PageRequest.of(0,25)).getTotalElements();};
   var first=executor.submit(load);var second=executor.submit(load);start.countDown();
   assertEquals(1L,first.get(30,java.util.concurrent.TimeUnit.SECONDS));assertEquals(1L,second.get(30,java.util.concurrent.TimeUnit.SECONDS));
   Long count=tx.execute(status->em.createQuery("select count(s) from CustomerMonthlySummary s where s.customer.id = :id",Long.class).setParameter("id",customerId).getSingleResult());assertEquals(1L,count);
  } finally {executor.shutdownNow();tx.executeWithoutResult(status->{em.createQuery("delete from CustomerMonthlySummary s where s.customer.id = :id").setParameter("id",customerId).executeUpdate();em.remove(em.find(Customer.class,customerId));});}
 }
}
