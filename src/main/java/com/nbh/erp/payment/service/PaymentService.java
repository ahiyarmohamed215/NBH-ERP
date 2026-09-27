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

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PagedResponse<PaymentDto> searchPayments(
            Long customerId,
            Long invoiceId,
            String paymentMethod,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String query,
            Pageable pageable
    ) {
        Page<PaymentDto> page = paymentRepository
                .searchPayments(customerId, invoiceId, paymentMethod, status, startDate, endDate, query, pageable)
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
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Payment amount must be greater than zero");
        }

        Invoice invoice = null;
        if (request.getInvoiceId() != null) {
            invoice = invoiceRepository.findById(request.getInvoiceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", request.getInvoiceId()));
        } else if (request.getInvoiceNumber() != null && !request.getInvoiceNumber().isBlank()) {
            invoice = invoiceRepository.findByInvoiceNumber(request.getInvoiceNumber().trim())
                    .orElse(null);
        }

        Customer customer = null;
        if (invoice != null) {
            customer = invoice.getCustomer();
            String invStatus = invoice.getStatus() != null ? invoice.getStatus().toUpperCase() : "COMPLETED";
            if ("VOIDED".equals(invStatus) || "CANCELLED".equals(invStatus)) {
                throw new BusinessException("Cannot accept payment for " + invStatus + " invoice: " + invoice.getInvoiceNumber());
            }
            if ("HELD".equals(invStatus)) {
                throw new BusinessException("Cannot accept payment for held bill: " + invoice.getInvoiceNumber() + ". Resume and complete it first.");
            }
            if ("PAID".equals(invStatus) && invoice.getBalanceAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException("Invoice " + invoice.getInvoiceNumber() + " is already paid in full.");
            }

            BigDecimal currentBalance = invoice.getBalanceAmount() != null ? invoice.getBalanceAmount() : invoice.getNetTotal();
            if (request.getAmount().compareTo(currentBalance) > 0) {
                log.warn("Payment amount {} exceeds invoice balance {}. Capping payment to exact balance.",
                        request.getAmount(), currentBalance);
            }

            // Update invoice balances atomically
            BigDecimal newPaid = (invoice.getPaidAmount() != null ? invoice.getPaidAmount() : BigDecimal.ZERO).add(request.getAmount());
            invoice.setPaidAmount(newPaid);

            BigDecimal newBal = invoice.getNetTotal().subtract(newPaid);
            if (newBal.compareTo(BigDecimal.ZERO) <= 0) {
                newBal = BigDecimal.ZERO;
                invoice.setStatus("PAID");
            } else {
                invoice.setStatus("PARTIAL");
            }
            invoice.setBalanceAmount(newBal);

            // Update customer balance if credit sale
            if (customer != null && customer.getCurrentBalance() != null && customer.getCurrentBalance().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal custBal = customer.getCurrentBalance().subtract(request.getAmount());
                customer.setCurrentBalance(custBal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : custBal);
                customerRepository.save(customer);
            }

            invoiceRepository.save(invoice);
        } else if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", request.getCustomerId()));
            if (customer.getCurrentBalance() != null && customer.getCurrentBalance().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal custBal = customer.getCurrentBalance().subtract(request.getAmount());
                customer.setCurrentBalance(custBal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : custBal);
                customerRepository.save(customer);
            }
        } else if (request.getCustomerName() != null && !request.getCustomerName().isBlank()) {
            List<Customer> matching = customerRepository.searchCustomers(request.getCustomerName().trim());
            if (!matching.isEmpty()) {
                customer = matching.get(0);
            }
        }

        if (customer == null) {
            customer = customerRepository.findByCustomerCode("CUST-0001")
                    .orElseGet(() -> customerRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new BusinessException("No valid customer found for payment receipt")));
        }

        String paymentNumber = sequenceService.generatePaymentNumber();
        LocalDate paymentDate = request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now();
        String method = request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank()
                ? request.getPaymentMethod().trim().toUpperCase() : "CASH";

        Payment payment = Payment.builder()
                .paymentNumber(paymentNumber)
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

        return PaymentDto.from(saved);
    }

    @Transactional
    public PaymentDto voidPayment(Long id, String reason) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", "id", id));

        if ("VOIDED".equalsIgnoreCase(payment.getStatus())) {
            throw new BusinessException("Payment " + payment.getPaymentNumber() + " is already voided.");
        }

        // Revert invoice amounts if linked
        Invoice invoice = payment.getInvoice();
        if (invoice != null && !"VOIDED".equalsIgnoreCase(invoice.getStatus())) {
            BigDecimal newPaid = invoice.getPaidAmount().subtract(payment.getAmount());
            if (newPaid.compareTo(BigDecimal.ZERO) < 0) newPaid = BigDecimal.ZERO;
            invoice.setPaidAmount(newPaid);

            BigDecimal newBal = invoice.getNetTotal().subtract(newPaid);
            if (newBal.compareTo(BigDecimal.ZERO) < 0) newBal = BigDecimal.ZERO;
            invoice.setBalanceAmount(newBal);

            if (newBal.compareTo(BigDecimal.ZERO) == 0 && newPaid.compareTo(BigDecimal.ZERO) > 0) {
                invoice.setStatus("PAID");
            } else if (newPaid.compareTo(BigDecimal.ZERO) > 0) {
                invoice.setStatus("PARTIAL");
            } else {
                invoice.setStatus("COMPLETED");
            }
            invoiceRepository.save(invoice);
        }

        // Restore customer balance
        Customer customer = payment.getCustomer();
        if (customer != null && customer.getCurrentBalance() != null) {
            customer.setCurrentBalance(customer.getCurrentBalance().add(payment.getAmount()));
            customerRepository.save(customer);
        }

        payment.setStatus("VOIDED");
        String voidNote = String.format(" [VOIDED on %s: %s]", LocalDate.now(), reason != null ? reason : "Manual void");
        payment.setNotes(payment.getNotes() != null ? payment.getNotes() + voidNote : voidNote);
        Payment saved = paymentRepository.save(payment);

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
}
