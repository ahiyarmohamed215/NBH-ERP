package com.nbh.erp.sales.service;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.customerrange.repository.CustomerRangeConfigRepository;
import com.nbh.erp.customerrange.entity.CustomerRangeConfig;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.role.entity.*;
import org.junit.jupiter.api.Test;
import java.math.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PosStaffPerformanceServiceTest {
 Invoice copy(long id,String author,int original,String status,int hour){
  var bill=Invoice.builder().id(id).customer(Customer.builder().id(1L).build()).invoiceDate(LocalDate.of(2026,10,20)).netTotal(BigDecimal.valueOf(30)).originalHeldTotal(BigDecimal.valueOf(original)).originalHeldSnapshot("saved original").status(status).build();
  bill.setCreatedBy(author);bill.setCreatedAt(LocalDateTime.of(2026,10,20,hour,0));if(!"YET_TO_PRINT".equals(status))bill.setOriginalHeldSentAt(bill.getCreatedAt());return bill;
 }
 @Test void ranksOriginalValuesAndCreditsCustomerThresholdCrossingsOnce(){
  var invoices=mock(InvoiceRepository.class);var users=mock(UserRepository.class);var ranges=mock(CustomerRangeConfigRepository.class);var originals=mock(HeldOriginalsService.class);var credits=mock(com.nbh.erp.salesreturn.repository.SalesReturnRepository.class);
  var targets=mock(com.nbh.erp.customertarget.repository.CustomerTargetRepository.class);
  var service=new PosStaffPerformanceService(invoices,users,ranges,originals,Clock.fixed(Instant.parse("2026-10-20T12:00:00Z"),ZoneId.of("Asia/Colombo")),credits,targets);
  var anna=copy(1,"anna",120,"MERGED",2);anna.setMergedInvoiceId(900L);var ben=copy(2,"ben",100,"YET_TO_PRINT",3);var carla=copy(3,"carla",60,"SENT_TO_WAREHOUSE",1);var daria=copy(4,"daria",100,"YET_TO_PRINT",4);
  var cancelled=copy(5,"ben",1000,"CANCELLED",5);var voided=copy(6,"ben",500,"MERGED",6);voided.setMergedInvoiceId(901L);var old=copy(7,"ben",1000,"SENT_TO_WAREHOUSE",7);old.setInvoiceDate(LocalDate.of(2026,9,20));
  when(invoices.findWarehouseOriginals()).thenReturn(List.of(anna,ben,carla,daria,cancelled,voided,old));
  when(invoices.findAllById(any())).thenReturn(List.of(Invoice.builder().id(900L).status("COMPLETED").build(),Invoice.builder().id(901L).status("VOIDED").build()));
  var legacy=copy(10,"office",40,"COMPLETED",0);legacy.setOriginalHeldSnapshot(null);legacy.setOriginalHeldSentAt(null);legacy.setNetTotal(BigDecimal.valueOf(40));
  when(invoices.findPerformanceDocuments(any(),any())).thenReturn(List.of(anna,legacy,carla));
  when(ranges.findByIsActiveTrueOrderByMinSpendAsc()).thenReturn(List.of(CustomerRangeConfig.builder().minSpend(BigDecimal.ZERO).build(),CustomerRangeConfig.builder().minSpend(BigDecimal.valueOf(100)).build(),CustomerRangeConfig.builder().minSpend(BigDecimal.valueOf(200)).build()));
  var role=Role.builder().name("POS").permissions(Set.of(Permission.builder().name("SALES_CREATE").build())).build();
  when(users.findAll()).thenReturn(List.of(User.builder().username("idle").fullName("Idle POS Staff").approvalStatus("APPROVED").roles(Set.of(role)).build(),User.builder().username("anna").fullName("Anna Fernando").build()));
  when(targets.findAllWithTiers()).thenReturn(List.of(com.nbh.erp.customertarget.entity.CustomerTarget.builder().id(1L).name("October goal").startDate(LocalDate.of(2026,10,1)).endDate(LocalDate.of(2026,10,31)).targetAmount(BigDecimal.valueOf(200)).build()));
  var result=service.performance(null);assertEquals(LocalDate.of(2026,10,1),result.periodStart());assertEquals(0,BigDecimal.valueOf(380).compareTo(result.teamAmount()));assertEquals(4,result.teamBillCount());assertEquals(2,result.rangeMilestones());
  var rows=result.staff();assertEquals(List.of("anna","ben","daria","carla","idle"),rows.stream().map(PosStaffPerformanceService.Staff::username).toList());assertEquals(List.of(1,2,2,4,5),rows.stream().map(PosStaffPerformanceService.Staff::rank).toList());
  assertEquals("Anna Fernando",rows.getFirst().fullName());assertEquals(1,rows.getFirst().rangeMilestones());assertEquals(1,rows.get(3).rangeMilestones());assertEquals(1,rows.get(1).pendingPrintCount());assertEquals(0,rows.get(1).rangeMilestones());assertEquals(0,BigDecimal.valueOf(20).compareTo(rows.get(1).gapToNext()));
  assertEquals(1,rows.getFirst().targetAchievements().size());assertEquals("October goal",rows.getFirst().targetAchievements().getFirst().target());
  assertEquals(1,rows.getFirst().customers().size());assertEquals("Range 200",rows.getFirst().customers().getFirst().range());assertEquals(1,rows.getFirst().customerRanges().getFirst().customers());
  assertEquals(0,BigDecimal.valueOf(120).compareTo(rows.getFirst().averageBillAmount()));assertEquals(0,rows.getLast().billCount());verifyNoInteractions(originals);
  var credit=com.nbh.erp.salesreturn.entity.SalesReturn.builder().id(99L).customer(Customer.builder().id(1L).build()).returnDate(LocalDate.of(2026,10,20)).totalAmount(BigDecimal.valueOf(50)).build();credit.setCreatedAt(LocalDateTime.of(2026,10,20,3,0));
  when(credits.findCompletedForPerformance(any(),any())).thenReturn(List.of(credit));var revised=service.performance(null);assertEquals(1,revised.rangeMilestones());assertEquals(0,revised.staff().getFirst().rangeMilestones());assertTrue(revised.staff().getFirst().targetAchievements().isEmpty());assertEquals(0,BigDecimal.valueOf(380).compareTo(revised.teamAmount()),"Returns must not rewrite original bill values");
  var nextMonth=service.performance("2026-11");assertEquals(0,nextMonth.teamAmount().signum());assertEquals(0,nextMonth.teamBillCount());assertEquals(1,nextMonth.staff().size());assertEquals("idle",nextMonth.staff().getFirst().username());
 }
 @Test void rejectsInvalidMonth(){
  var service=new PosStaffPerformanceService(mock(InvoiceRepository.class),mock(UserRepository.class),mock(CustomerRangeConfigRepository.class),mock(HeldOriginalsService.class),Clock.systemUTC(),mock(com.nbh.erp.salesreturn.repository.SalesReturnRepository.class),mock(com.nbh.erp.customertarget.repository.CustomerTargetRepository.class));
  assertThrows(com.nbh.erp.common.exception.BusinessException.class,()->service.performance("2026-13"));
 }
 @Test void campaignUsesEarlierMonthsWithoutAwardingTheSameAchievementAgain(){
  var invoices=mock(InvoiceRepository.class);var users=mock(UserRepository.class);var ranges=mock(CustomerRangeConfigRepository.class);var credits=mock(com.nbh.erp.salesreturn.repository.SalesReturnRepository.class);var targets=mock(com.nbh.erp.customertarget.repository.CustomerTargetRepository.class);
  var service=new PosStaffPerformanceService(invoices,users,ranges,mock(HeldOriginalsService.class),Clock.systemUTC(),credits,targets);
  var september=copy(1,"anna",120,"SENT_TO_WAREHOUSE",1);september.setInvoiceDate(LocalDate.of(2026,9,20));
  var october=copy(2,"ben",20,"SENT_TO_WAREHOUSE",2);
  when(invoices.findWarehouseOriginals()).thenReturn(List.of(september,october));
  when(invoices.findPerformanceDocuments(any(),any())).thenAnswer(call->{LocalDate from=call.getArgument(0),to=call.getArgument(1);return List.of(september,october).stream().filter(b->!b.getInvoiceDate().isBefore(from) && !b.getInvoiceDate().isAfter(to)).toList();});
  var target=com.nbh.erp.customertarget.entity.CustomerTarget.builder().id(1L).name("Autumn goal").startDate(LocalDate.of(2026,9,1)).endDate(LocalDate.of(2026,10,31)).targetAmount(BigDecimal.valueOf(100)).build();
  when(targets.findAllWithTiers()).thenReturn(List.of(target));
  assertEquals(1,service.performance("2026-09").staff().getFirst().targetAchievements().size());
  var next=service.performance("2026-10");assertEquals("ben",next.staff().getFirst().username());assertTrue(next.staff().getFirst().targetAchievements().isEmpty(),"September achievement must not be counted in October");
  target.setCustomer(Customer.builder().id(99L).build());assertTrue(service.performance("2026-09").staff().getFirst().targetAchievements().isEmpty(),"A customer-specific target must not count another customer's bills");
 }
}
