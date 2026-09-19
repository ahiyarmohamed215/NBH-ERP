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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesReturnService {

    private final SalesReturnRepository salesReturnRepository;
    private final CreditNoteRepository creditNoteRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

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
        Invoice invoice = invoiceRepository.findById(request.getInvoiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", request.getInvoiceId()));

        if (!"COMPLETED".equals(invoice.getStatus())) {
            throw new BusinessException("Returns can only be processed against COMPLETED invoices");
        }

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
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal lineTotal = itemReq.getQuantity().multiply(itemReq.getUnitPrice());
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
                        product.getCostPrice(),
                        "SALE_RETURN",
                        returnNumber,
                        "Return against Invoice: " + invoice.getInvoiceNumber()
                );
            }
        }

        salesReturn.setTotalAmount(grandTotal);
        SalesReturn savedReturn = salesReturnRepository.save(salesReturn);

        // If return type is CREDIT_NOTE, generate a credit note for the customer
        if ("CREDIT_NOTE".equalsIgnoreCase(savedReturn.getReturnType())) {
            String crnNumber = sequenceService.generateCreditNoteNumber();
            CreditNote creditNote = CreditNote.builder()
                    .creditNoteNumber(crnNumber)
                    .salesReturn(savedReturn)
                    .customer(savedReturn.getCustomer())
                    .amount(grandTotal)
                    .status("ISSUED")
                    .issueDate(retDate)
                    .build();
            creditNoteRepository.save(creditNote);
            log.info("Credit Note '{}' issued for customer '{}' amount: {}",
                    crnNumber, savedReturn.getCustomer().getName(), grandTotal);
        }

        // If customer had an outstanding balance, adjust balance if requested
        Customer customer = savedReturn.getCustomer();
        if (customer.getCurrentBalance() != null && customer.getCurrentBalance().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal newBal = customer.getCurrentBalance().subtract(grandTotal);
            customer.setCurrentBalance(newBal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newBal);
            customerRepository.save(customer);
        }

        log.info("Sales return '{}' completed against invoice '{}'. Total refunded: {}",
                returnNumber, invoice.getInvoiceNumber(), grandTotal);

        return SalesReturnDto.from(savedReturn);
    }
}
