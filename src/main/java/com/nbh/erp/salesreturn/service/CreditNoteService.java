package com.nbh.erp.salesreturn.service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.nbh.erp.salesreturn.repository.*;
import com.nbh.erp.common.exception.BusinessException;
import java.math.BigDecimal;
import java.time.LocalDate;
@Service @RequiredArgsConstructor
public class CreditNoteService {
 private final com.nbh.erp.common.service.IdempotencyService idempotency;
 private final CreditNoteRepository notes;
 private final CreditAllocationRepository allocations;
 private final com.nbh.erp.sales.repository.InvoiceRepository invoices;
 private final com.nbh.erp.customer.service.CustomerBalanceService balances;
 public record Credit(Long id,String number,Long customerId,BigDecimal amount,BigDecimal available,String status) {}
 public record Allocation(Long id,Long invoiceId,BigDecimal amount,boolean reversed) {}
 private Credit dto(com.nbh.erp.salesreturn.entity.CreditNote n) { return new Credit(n.getId(),n.getCreditNoteNumber(),n.getCustomer().getId(),n.getAmount(),n.getAmount().subtract(n.getAppliedAmount()),n.getStatus()); }
 @Transactional(readOnly=true) public java.util.List<Credit> list() { return notes.findAll().stream().map(this::dto).toList(); }
 @Transactional(readOnly=true) public java.util.List<Allocation> allocations(Long id) { return allocations.findByCreditNoteId(id).stream().map(a->new Allocation(a.getId(),a.getInvoice().getId(),a.getAmount(),a.isReversed())).toList(); }
 @Transactional public Credit apply(Long id,Long invoiceId,BigDecimal amount) {
  var ticket=idempotency.reserve("applyCredit",id+"|"+invoiceId+"|"+amount);
  if(ticket!=null && ticket.getResourceId()!=null) return dto(notes.findById(ticket.getResourceId()).orElseThrow());
  if(amount!=null) amount=amount.setScale(2,java.math.RoundingMode.UNNECESSARY);
  var note=notes.lockById(id).orElseThrow(() -> new BusinessException("Unknown credit note"));
  var invoice=invoices.findByIdForUpdate(invoiceId).orElseThrow(() -> new BusinessException("Unknown invoice"));
  if(!"ISSUED".equals(note.getStatus()) || !note.getCustomer().getId().equals(invoice.getCustomer().getId()) || !com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus())) throw new BusinessException("Credit cannot be applied to this invoice");
  if(amount==null || amount.signum()<=0 || amount.compareTo(note.getAmount().subtract(note.getAppliedAmount()))>0 || amount.compareTo(invoice.getBalanceAmount())>0) throw new BusinessException("Credit exceeds available amount or invoice balance");
  var allocation=new com.nbh.erp.salesreturn.entity.CreditAllocation(); allocation.setCreditNote(note);allocation.setInvoice(invoice);allocation.setAmount(amount);allocations.save(allocation);
  note.setAppliedAmount(note.getAppliedAmount().add(amount));if(note.getAppliedAmount().compareTo(note.getAmount())==0) note.setStatus("APPLIED");notes.save(note);
  invoice.setPaidAmount(invoice.getPaidAmount().add(amount));com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);invoices.save(invoice);balances.reconcile(note.getCustomer().getId());
  return idempotency.complete(ticket,id,dto(note));
 }
 @Transactional public void reverse(Long id,String reason) {
  var allocation=allocations.lockById(id).orElseThrow(() -> new BusinessException("Unknown allocation"));
  var note=notes.lockById(allocation.getCreditNote().getId()).orElseThrow(); var invoice=invoices.findByIdForUpdate(allocation.getInvoice().getId()).orElseThrow();
  if(allocation.isReversed() || invoice.getPaidAmount().compareTo(allocation.getAmount())<0 || !com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus())) throw new BusinessException("Allocation is reversed or dependent transactions must be reversed first");
  invoice.setPaidAmount(invoice.getPaidAmount().subtract(allocation.getAmount()));com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);invoices.save(invoice);
  note.setAppliedAmount(note.getAppliedAmount().subtract(allocation.getAmount()));note.setStatus("ISSUED");notes.save(note);allocation.setReversed(true);allocations.save(allocation);
  balances.reconcile(note.getCustomer().getId());
 }
}
