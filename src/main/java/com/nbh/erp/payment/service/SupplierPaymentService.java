package com.nbh.erp.payment.service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.nbh.erp.common.exception.BusinessException;
import java.math.BigDecimal;
import java.time.LocalDate;
@Service @RequiredArgsConstructor
public class SupplierPaymentService {
 private final com.nbh.erp.common.service.IdempotencyService idempotency;
 private final com.nbh.erp.payment.repository.SupplierPaymentRepository payments;
 private final com.nbh.erp.grn.repository.GrnRepository grns;
 private final com.nbh.erp.purchasereturn.repository.PurchaseReturnRepository returns;
 public record Receipt(Long id,String grnNumber,String supplier,BigDecimal total,BigDecimal returns,BigDecimal paid,BigDecimal balance) {}
 public record Payment(Long id,Long grnId,String supplier,BigDecimal amount,LocalDate date,String method,boolean reversed) {}
 private Payment dto(com.nbh.erp.payment.entity.SupplierPayment p) { return new Payment(p.getId(),p.getGrn().getId(),p.getGrn().getSupplier().getName(),p.getAmount(),p.getPaymentDate(),p.getMethod(),p.isReversed()); }
 @Transactional(readOnly=true) public java.util.List<Payment> list() { return payments.findAll().stream().map(this::dto).toList(); }
 @Transactional(readOnly=true) public java.util.List<Receipt> outstanding() {
  return grns.findAll().stream().filter(g->"PROCESSED".equals(g.getStatus())).map(g->{var returned=returns.totalReturned(g.getId());var paid=payments.totalPaid(g.getId());return new Receipt(g.getId(),g.getGrnNumber(),g.getSupplier().getName(),g.getTotalAmount(),returned,paid,g.getTotalAmount().subtract(returned).subtract(paid));}).toList();
 }
 @Transactional public Payment pay(Long grnId,BigDecimal amount,String method) {
  var ticket=idempotency.reserve("supplierPayment",grnId+"|"+amount+"|"+method);
  if(ticket!=null && ticket.getResourceId()!=null) return dto(payments.findById(ticket.getResourceId()).orElseThrow());
  if(amount!=null) amount=amount.setScale(2,java.math.RoundingMode.UNNECESSARY);
  var grn=grns.findByIdForUpdate(grnId).orElseThrow(()->new BusinessException("Unknown GRN"));
  if(!"PROCESSED".equals(grn.getStatus())) throw new BusinessException("GRN is not processed");
  if(amount==null || amount.signum()<=0 || amount.compareTo(grn.getTotalAmount().subtract(returns.totalReturned(grnId)).subtract(payments.totalPaid(grnId)))>0) throw new BusinessException("Amount exceeds supplier balance");
  if(!java.util.Set.of("CASH","BANK_TRANSFER","CARD").contains(method)) throw new BusinessException("Invalid supplier payment method");
  var p=new com.nbh.erp.payment.entity.SupplierPayment();p.setGrn(grn);p.setAmount(amount);p.setMethod(method);p.setPaymentDate(LocalDate.now());payments.save(p);
  return idempotency.complete(ticket,p.getId(),dto(p));
 }
 @Transactional public Payment reverse(Long id,String reason) {
  var p=payments.lockById(id).orElseThrow();grns.findByIdForUpdate(p.getGrn().getId()).orElseThrow();if(p.isReversed()) throw new BusinessException("Payment already reversed");
  p.setReversed(true);payments.save(p);return dto(p);
 }
}
