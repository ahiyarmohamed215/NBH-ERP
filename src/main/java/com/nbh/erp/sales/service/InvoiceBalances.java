package com.nbh.erp.sales.service;
import com.nbh.erp.sales.entity.Invoice;
import java.math.BigDecimal;
import java.util.Set;
public final class InvoiceBalances {
 public static final Set<String> POSTED = Set.of("COMPLETED","PARTIAL","PAID");
 private InvoiceBalances() {}
 public static BigDecimal effectiveTotal(Invoice i) { return i.getNetTotal().subtract(i.getReturnedAmount()).max(BigDecimal.ZERO); }
 public static void recalculate(Invoice i) {
  i.setBalanceAmount(effectiveTotal(i).subtract(i.getPaidAmount()).max(BigDecimal.ZERO));
  i.setStatus(i.getBalanceAmount().signum()==0 ? "PAID" : i.getPaidAmount().signum()>0 ? "PARTIAL" : "COMPLETED");
 }
}
