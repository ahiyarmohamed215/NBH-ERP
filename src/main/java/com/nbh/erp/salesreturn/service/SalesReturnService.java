package com.nbh.erp.salesreturn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.salesreturn.dto.CreateSalesReturnRequest;
import com.nbh.erp.salesreturn.dto.SalesReturnDto;
import com.nbh.erp.salesreturn.entity.CreditNote;
import com.nbh.erp.salesreturn.entity.SalesReturn;
import com.nbh.erp.salesreturn.entity.SalesReturnItem;
import com.nbh.erp.salesreturn.repository.CreditNoteRepository;
import com.nbh.erp.salesreturn.repository.SalesReturnRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesReturnService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final SalesReturnRepository salesReturnRepository;
    private final CreditNoteRepository creditNoteRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final com.nbh.erp.customer.service.CustomerBalanceService customerBalances;
    private final com.nbh.erp.audit.service.AuditLogService auditLogService;
    private final com.nbh.erp.customerrange.service.CustomerRangeService customerRangeService;

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
            return auth.getName();
        }
        return "SYSTEM";
    }

    @Transactional(readOnly = true)
    public PagedResponse<SalesReturnDto> searchSalesReturns(
            Long warehouseId,
            Long customerId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<SalesReturnDto> page = salesReturnRepository
                .searchSalesReturns(warehouseId, customerId, status, query, pageable)
                .map(SalesReturnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public SalesReturnDto getSalesReturnById(Long id) {
        SalesReturn sr = salesReturnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales Return", "id", id));
        return SalesReturnDto.from(sr);
    }

    @Transactional
    public SalesReturnDto createSalesReturn(CreateSalesReturnRequest request) {
        var ticket=idempotency.reserve("createSalesReturn",request);
        if(ticket!=null && ticket.getResourceId()!=null) return getSalesReturnById(ticket.getResourceId());

        Invoice invoice = invoiceRepository.findByIdForUpdate(request.getInvoiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", request.getInvoiceId()));

        if (!com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(invoice.getStatus())) {
            throw new BusinessException("Returns require a posted invoice");
        }

        if(!java.util.Set.of("REFUND","CREDIT_NOTE").contains(request.getReturnType().toUpperCase())) throw new BusinessException("Invalid return type");
        customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
        java.util.Set<Long> seen = new java.util.HashSet<>();
        String returnNumber = sequenceService.generateReturnNumber();
        LocalDate retDate = request.getReturnDate() != null ? request.getReturnDate() : LocalDate.now();

        SalesReturn salesReturn = SalesReturn.builder()
                .returnNumber(returnNumber)
                .invoice(invoice)
                .warehouse(invoice.getWarehouse())
                .customer(invoice.getCustomer())
                .returnType(request.getReturnType() != null ? request.getReturnType().toUpperCase() : "REFUND")
                .returnDate(retDate)
                .reason(request.getReason())
                .status("COMPLETED")
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        BigDecimal grandTotal = BigDecimal.ZERO;
        Long warehouseId = invoice.getWarehouse().getId();

        for (CreateSalesReturnRequest.CreateSalesReturnItemRequest itemReq : request.getItems()) {
            var original=invoice.getItems().stream().filter(x -> java.util.Objects.equals(x.getId(),itemReq.getInvoiceItemId())).findFirst()
                .orElseThrow(() -> new BusinessException("Select an original invoice line"));
            if(!seen.add(original.getId())) throw new BusinessException("Duplicate return line");
            if(!original.getProduct().getId().equals(itemReq.getProductId())) throw new BusinessException("Product does not match original invoice line");
            BigDecimal returned=salesReturnRepository.returnedQuantity(original.getId());
            if(itemReq.getQuantity()==null || itemReq.getQuantity().signum()<=0 || returned.add(itemReq.getQuantity()).compareTo(original.getQuantity())>0) throw new BusinessException("Return exceeds unreturned sold quantity");
            Product product=original.getProduct();
            BigDecimal lineTotal=invoice.getSubtotal().signum()==0 ? BigDecimal.ZERO : original.getTotalPrice().multiply(itemReq.getQuantity())
                .multiply(invoice.getNetTotal()).divide(original.getQuantity().multiply(invoice.getSubtotal()),2,java.math.RoundingMode.HALF_UP);
            lineTotal=lineTotal.min(invoice.getNetTotal().subtract(invoice.getReturnedAmount()).subtract(grandTotal).max(BigDecimal.ZERO));
            itemReq.setUnitPrice(lineTotal.divide(itemReq.getQuantity(),6,java.math.RoundingMode.HALF_UP));
            grandTotal = grandTotal.add(lineTotal);

            boolean isRestockable = !"DAMAGED".equalsIgnoreCase(itemReq.getConditionType());

            SalesReturnItem item = SalesReturnItem.builder()
                    .salesReturn(salesReturn)
                    .invoiceItemId(itemReq.getInvoiceItemId())
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(itemReq.getUnitPrice())
                    .conditionType(isRestockable ? "RESTOCKABLE" : "DAMAGED")
                    .totalAmount(lineTotal)
                    .isRestocked(isRestockable)
                    .build();

            salesReturn.getItems().add(item);

            // If condition is restockable, increase stock in warehouse
            if (isRestockable) {
                stockService.increaseStock(
                        warehouseId,
                        product.getId(),
                        itemReq.getQuantity(),
                        original.getCostPrice(),
                        "SALE_RETURN",
                        returnNumber,
                        "Return against Invoice: " + invoice.getInvoiceNumber()
                );
            }
        }

        salesReturn.setTotalAmount(grandTotal);
        SalesReturn savedReturn = salesReturnRepository.save(salesReturn);

        BigDecimal oldPaid=invoice.getPaidAmount();
        invoice.setReturnedAmount(invoice.getReturnedAmount().add(grandTotal));
        BigDecimal refund=oldPaid.subtract(com.nbh.erp.sales.service.InvoiceBalances.effectiveTotal(invoice)).max(BigDecimal.ZERO);
        invoice.setPaidAmount(oldPaid.subtract(refund));
        com.nbh.erp.sales.service.InvoiceBalances.recalculate(invoice);
        invoiceRepository.save(invoice);
        savedReturn.setRefundAmount("CREDIT_NOTE".equals(savedReturn.getReturnType()) ? BigDecimal.ZERO : refund);
        if("CREDIT_NOTE".equals(savedReturn.getReturnType()) && refund.signum()>0) {
            creditNoteRepository.save(CreditNote.builder().creditNoteNumber(sequenceService.generateCreditNoteNumber())
                .salesReturn(savedReturn).customer(savedReturn.getCustomer()).amount(refund).status("ISSUED").issueDate(retDate)
                .createdBy(getCurrentUsername()).updatedBy(getCurrentUsername()).build());
        }
        customerBalances.reconcile(invoice.getCustomer().getId());
        auditLogService.log("SALES_RETURN","SalesReturn",returnNumber,"Returned "+grandTotal+", refund/credit "+refund);

        try {
            customerRangeService.onSalesReturnCompleted(savedReturn);
        } catch (Exception e) {
            log.error("Failed to sync customer range on sales return {}: {}", returnNumber, e.getMessage());
        }

        log.info("Sales return '{}' completed against invoice '{}'. Total refunded: {}",
                returnNumber, invoice.getInvoiceNumber(), grandTotal);

        return idempotency.complete(ticket,savedReturn.getId(),SalesReturnDto.from(savedReturn));
    }
}
