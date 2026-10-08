package com.nbh.erp.payment.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.payment.dto.CreatePaymentRequest;
import com.nbh.erp.payment.dto.PaymentDto;
import com.nbh.erp.payment.entity.Payment;
import com.nbh.erp.payment.repository.PaymentRepository;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;
    private final com.nbh.erp.customer.service.CustomerBalanceService customerBalances;
    private final com.nbh.erp.accounting.service.AccountingService accounting;
    private final com.nbh.erp.payment.repository.PaymentAllocationRepository allocations;

    @Transactional(readOnly = true)
    public PagedResponse<PaymentDto> searchPayments(
            Long customerId,
            Long invoiceId,
            String paymentType,
            String paymentMethod,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String query,
            Pageable pageable
    ) {
        Page<PaymentDto> page = paymentRepository
                .searchPayments(customerId, invoiceId, paymentType, paymentMethod, status, startDate, endDate, query, pageable)
                .map(PaymentDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public PaymentDto getPaymentById(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", "id", id));
        return PaymentDto.from(payment);
    }

    @Transactional
    public PaymentDto processPayment(CreatePaymentRequest request) {
        var ticket=idempotency.reserve("processPayment",request);
        if(ticket!=null && ticket.getResourceId()!=null) return getPaymentById(ticket.getResourceId());

        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Payment amount must be greater than zero");
        }

        Invoice invoice = null;
        if(request.getInvoiceId()!=null) invoice=invoiceRepository.findByIdForUpdate(request.getInvoiceId()).orElseThrow(() -> new BusinessException("Unknown invoice"));
        else if(request.getInvoiceNumber()!=null && !request.getInvoiceNumber().isBlank()) invoice=invoiceRepository.findByNumberForUpdate(request.getInvoiceNumber().trim()).orElseThrow(() -> new BusinessException("Unknown invoice number"));
        Customer customer;
        if(invoice!=null) {
            if(!com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus())) throw new BusinessException("Invoice is not payable");
            if(request.getCustomerId()!=null && !request.getCustomerId().equals(invoice.getCustomer().getId())) throw new BusinessException("Customer does not match invoice");
            customer=customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
            if(request.getAmount().compareTo(invoice.getBalanceAmount())>0) throw new BusinessException("Payment exceeds invoice balance; record excess as a separate advance");
            invoice.setPaidAmount(invoice.getPaidAmount().add(request.getAmount()));
            com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);
            invoiceRepository.save(invoice);
        } else {
            if(request.getCustomerId()==null) throw new BusinessException("Select a valid customer for an advance");
            customer=customerRepository.findByIdForUpdate(request.getCustomerId()).orElseThrow(() -> new BusinessException("Unknown customer"));
        }
        if(!Boolean.TRUE.equals(customer.getIsActive())) throw new BusinessException("Customer is inactive");
        String pType=invoice==null ? "ADVANCE" : "INVOICE_PAYMENT";
        if(request.getPaymentType()!=null && !pType.equalsIgnoreCase(request.getPaymentType())) throw new BusinessException("Payment type does not match invoice selection");

        String paymentNumber = "ADVANCE".equals(pType)
                ? sequenceService.generateAdvanceVoucherNumber()
                : sequenceService.generatePaymentNumber();

        LocalDate paymentDate = request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now();
        String method = request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank()
                ? request.getPaymentMethod().trim().toUpperCase().replace(' ','_') : "CASH";
        if(!java.util.Set.of("CASH","CARD","BANK_TRANSFER","CHEQUE","ONLINE").contains(method)) throw new BusinessException("Invalid payment method");

        Payment payment = Payment.builder()
                .paymentNumber(paymentNumber)
                .paymentType(pType)
                .invoice(invoice)
                .customer(customer)
                .amount(request.getAmount())
                .paymentMethod(method)
                .referenceNumber(request.getReferenceNumber())
                .paymentDate(paymentDate)
                .status("COMPLETED")
                .notes(request.getNotes())
                .build();

        Payment saved = paymentRepository.save(payment);
        accounting.transfer("PAYMENT-"+saved.getId(),saved.getPaymentDate(),saved.getPaymentNumber(),"PAYMENT",com.nbh.erp.accounting.service.AccountingService.cashAccount(saved.getPaymentMethod()),invoice==null?"DEPOSITS":"AR",saved.getAmount());
        customerBalances.reconcile(customer.getId());

        String username = SecurityUtils.getCurrentUsername().orElse("system");
        auditLogService.log(
                "PAYMENT_RECEIVE",
                "Payment",
                saved.getPaymentNumber(),
                String.format("Payment %s of %s received for customer '%s'%s via %s by %s",
                        saved.getPaymentNumber(),
                        saved.getAmount(),
                        customer.getName(),
                        invoice != null ? " (Invoice: " + invoice.getInvoiceNumber() + ")" : "",
                        saved.getPaymentMethod(),
                        username)
        );

        log.info("Payment receipt {} processed for amount {} (Invoice: {})",
                saved.getPaymentNumber(), saved.getAmount(), invoice != null ? invoice.getInvoiceNumber() : "Direct");

        return idempotency.complete(ticket,saved.getId(),PaymentDto.from(saved));
    }

    @Transactional
    public PaymentDto voidPayment(Long id, String reason) {
        Payment payment = paymentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", "id", id));

        if ("VOIDED".equalsIgnoreCase(payment.getStatus())) {
            throw new BusinessException("Payment " + payment.getPaymentNumber() + " is already voided.");
        }

        if(reason==null || reason.isBlank()) throw new BusinessException("A reversal reason is required");
        Customer customer=customerRepository.findByIdForUpdate(payment.getCustomer().getId()).orElseThrow();
        if(payment.getInvoice()!=null) reverseInvoicePayment(payment.getInvoice().getId(),payment.getAmount());
        for(var allocation:allocations.findByPaymentIdAndReversedFalse(payment.getId())) {
            reverseInvoicePayment(allocation.getInvoice().getId(),allocation.getAmount());
            accounting.reverseSource("ALLOCATION-"+allocation.getId(),reason);
            allocation.setReversed(true); allocations.save(allocation);
        }

        accounting.reverseSource("PAYMENT-"+payment.getId(),reason);
        payment.setStatus("VOIDED");
        String voidNote = String.format(" [VOIDED on %s: %s]", LocalDate.now(), reason != null ? reason : "Manual void");
        payment.setNotes(payment.getNotes() != null ? payment.getNotes() + voidNote : voidNote);
        Payment saved = paymentRepository.save(payment);
        customerBalances.reconcile(customer.getId());

        String username = SecurityUtils.getCurrentUsername().orElse("system");
        auditLogService.log(
                "PAYMENT_VOID",
                "Payment",
                saved.getPaymentNumber(),
                String.format("Payment %s voided by %s. Reason: %s",
                        saved.getPaymentNumber(), username, reason != null ? reason : "No reason provided")
        );

        log.info("Payment receipt {} voided.", saved.getPaymentNumber());
        return PaymentDto.from(saved);
    }

    private void reverseInvoicePayment(Long id, BigDecimal amount) {
        Invoice invoice=invoiceRepository.findByIdForUpdate(id).orElseThrow();
        if(!com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus()) || invoice.getPaidAmount().compareTo(amount)<0)
            throw new BusinessException("Payment has been refunded or invoice is closed; reverse dependent transactions first");
        invoice.setPaidAmount(invoice.getPaidAmount().subtract(amount));
        com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);
        invoiceRepository.save(invoice);
    }
    @Transactional
    public PaymentDto allocateAdvance(Long paymentId, Long invoiceId, BigDecimal amount) {
        var ticket=idempotency.reserve("allocateAdvance",paymentId+"|"+invoiceId+"|"+amount);
        if(ticket!=null && ticket.getResourceId()!=null) return getPaymentById(ticket.getResourceId());
        if(amount!=null) amount=amount.setScale(2,java.math.RoundingMode.UNNECESSARY);
        Payment payment=paymentRepository.findByIdForUpdate(paymentId).orElseThrow(() -> new BusinessException("Unknown payment"));
        if(!"ADVANCE".equals(payment.getPaymentType()) || !"COMPLETED".equals(payment.getStatus())) throw new BusinessException("An active advance is required");
        var invoice=invoiceRepository.findByIdForUpdate(invoiceId).orElseThrow(() -> new BusinessException("Unknown invoice"));
        if(!payment.getCustomer().getId().equals(invoice.getCustomer().getId()) || !com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus())) throw new BusinessException("Invoice/customer mismatch");
        BigDecimal used=allocations.findByPaymentIdAndReversedFalse(paymentId).stream().map(com.nbh.erp.payment.entity.PaymentAllocation::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        if(amount==null || amount.signum()<=0 || amount.compareTo(payment.getAmount().subtract(used))>0 || amount.compareTo(invoice.getBalanceAmount())>0) throw new BusinessException("Allocation exceeds available credit or invoice balance");
        customerRepository.findByIdForUpdate(payment.getCustomer().getId()).orElseThrow();
        var allocation=new com.nbh.erp.payment.entity.PaymentAllocation();
        allocation.setPayment(payment); allocation.setInvoice(invoice); allocation.setAmount(amount); allocations.save(allocation);
        accounting.transfer("ALLOCATION-"+allocation.getId(),LocalDate.now(),"Advance allocation","PAYMENT","DEPOSITS","AR",amount);
        invoice.setPaidAmount(invoice.getPaidAmount().add(amount)); com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);
        invoiceRepository.save(invoice); customerBalances.reconcile(payment.getCustomer().getId());
        auditLogService.log("ADVANCE_ALLOCATE","Payment",payment.getPaymentNumber(),"Allocated "+amount+" to "+invoice.getInvoiceNumber());
        return idempotency.complete(ticket,paymentId,PaymentDto.from(payment));
    }
}
