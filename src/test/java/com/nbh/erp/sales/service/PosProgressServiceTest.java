package com.nbh.erp.sales.service;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class PosProgressServiceTest {
 @Test void serverSeparatesCompletedPurchasesFromSavedBillProjection(){
  var value=PosProgressService.milestone("Next range",new BigDecimal("500"),new BigDecimal("100"),new BigDecimal("125"),"");
  assertEquals(0,new BigDecimal("20").compareTo(value.completedPercent()));
  assertEquals(0,new BigDecimal("25").compareTo(value.billPercent()));
  assertEquals(0,new BigDecimal("275").compareTo(value.remaining()));assertEquals("IN_PROGRESS",value.state());
 }
 @Test void reachedAndExceededMilestonesStayWithinTheProgressBar(){
  var value=PosProgressService.milestone("Range",BigDecimal.TEN,BigDecimal.valueOf(8),BigDecimal.valueOf(5),"");
  assertEquals("WITH_BILL",value.state());assertEquals(0,value.remaining().signum());
  assertEquals(0,BigDecimal.valueOf(100).compareTo(value.completedPercent().add(value.billPercent())));
  assertEquals("ACHIEVED",PosProgressService.milestone("Base",BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.TEN,"").state());
 }
}
