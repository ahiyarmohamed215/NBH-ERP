package com.nbh.erp.quotation.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.quotation.dto.CreateQuotationRequest;
import com.nbh.erp.quotation.dto.QuotationDto;
import com.nbh.erp.quotation.entity.Quotation;
import com.nbh.erp.quotation.entity.QuotationItem;
import com.nbh.erp.quotation.repository.QuotationRepository;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.service.InvoiceService;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotationService {

    private final QuotationRepository quotationRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final WarehouseRepository warehouseRepository;
    private final DocumentSequenceService sequenceService;
    private final AuditLogService auditLogService;
    private final InvoiceService invoiceService;

    @Transactional(readOnly = true)
    public PagedResponse<QuotationDto> searchQuotations(
            Long customerId,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String query,
            Pageable pageable
    ) {
        Page<QuotationDto> page = quotationRepository
                .searchQuotations(customerId, status, startDate, endDate, query, pageable)
                .map(QuotationDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public QuotationDto getQuotationById(Long id) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quotation", "id", id));
        return QuotationDto.from(quotation);
    }

    @Transactional
    public QuotationDto createQuotation(CreateQuotationRequest request) {
        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElse(null);
        } else if (request.getCustomerName() != null && !request.getCustomerName().isBlank()) {
            List<Customer> matching = customerRepository.searchCustomers(request.getCustomerName().trim());
            if (!matching.isEmpty()) {
                customer = matching.get(0);
            }
        }

        if (customer != null && Boolean.FALSE.equals(customer.getIsActive())) {
            throw new com.nbh.erp.common.exception.BusinessException("Cannot issue quotation for inactive customer: " + customer.getName());
        }

        String quotationNumber = sequenceService.generateQuotationNumber();
        LocalDate qDate = request.getQuotationDate() != null ? request.getQuotationDate() : LocalDate.now();
        LocalDate validUntil = request.getValidUntil() != null ? request.getValidUntil() : qDate.plusDays(30);

        Quotation quotation = Quotation.builder()
                .quotationNumber(quotationNumber)
                .customer(customer)
                .customerName(customer != null ? customer.getName() : request.getCustomerName())
                .customerPhone(customer != null ? customer.getPhone() : request.getCustomerPhone())
                .customerEmail(customer != null ? customer.getEmail() : request.getCustomerEmail())
                .quotationDate(qDate)
                .validUntil(validUntil)
                .status("PENDING")
                .notes(request.getNotes())
                .terms(request.getTerms())
                .items(new ArrayList<>())
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal totalDiscount = request.getDiscountAmount() != null ? request.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal taxAmount = request.getTaxAmount() != null ? request.getTaxAmount() : BigDecimal.ZERO;

        if (request.getItems() != null && !request.getItems().isEmpty()) {
            for (CreateQuotationRequest.CreateQuotationItemRequest itemReq : request.getItems()) {
                Product product = null;
                if (itemReq.getProductId() != null) {
                    product = productRepository.findById(itemReq.getProductId()).orElse(null);
                }

                String pName = itemReq.getProductName() != null ? itemReq.getProductName()
                        : (product != null ? product.getName() : "Product Item");
                String pSku = itemReq.getProductSku() != null ? itemReq.getProductSku()
                        : (product != null ? product.getSku() : "SKU");
                int qty = itemReq.getQuantity() != null && itemReq.getQuantity() > 0 ? itemReq.getQuantity() : 1;
                BigDecimal unitPrice = itemReq.getUnitPrice() != null ? itemReq.getUnitPrice()
                        : (product != null && product.getSellingPrice() != null ? product.getSellingPrice() : BigDecimal.ZERO);
                BigDecimal discRate = itemReq.getDiscountRate() != null ? itemReq.getDiscountRate() : BigDecimal.ZERO;
                BigDecimal discAmount = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;

                BigDecimal itemTotal = itemReq.getTotalPrice() != null ? itemReq.getTotalPrice()
                        : unitPrice.multiply(BigDecimal.valueOf(qty)).subtract(discAmount);

                QuotationItem item = QuotationItem.builder()
                        .product(product)
                        .productSku(pSku)
                        .productName(pName)
                        .quantity(qty)
                        .unitPrice(unitPrice)
                        .discountRate(discRate)
                        .discountAmount(discAmount)
                        .totalPrice(itemTotal)
                        .build();

                quotation.addItem(item);
                subtotal = subtotal.add(itemTotal);
            }
        } else if (request.getTotalAmount() != null && request.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
            subtotal = request.getTotalAmount();
        }

        quotation.setSubtotal(subtotal);
        quotation.setDiscountAmount(totalDiscount);
        quotation.setTaxAmount(taxAmount);
        BigDecimal grandTotal = subtotal.subtract(totalDiscount).add(taxAmount);
        quotation.setTotalAmount(grandTotal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : grandTotal);

        Quotation saved = quotationRepository.save(quotation);

        String username = SecurityUtils.getCurrentUsername().orElse("system");
        auditLogService.log(
                "QUOTATION_CREATE",
                "Quotation",
                saved.getQuotationNumber(),
                String.format("Quotation %s created for customer '%s' totaling %s by %s",
                        saved.getQuotationNumber(),
                        saved.getCustomerName(),
                        saved.getTotalAmount(),
                        username)
        );

        return QuotationDto.from(saved);
    }

    @Transactional
    public QuotationDto updateQuotation(Long id, CreateQuotationRequest request) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quotation", "id", id));

        SecurityUtils.enforceCanEdit("QUOTATION", quotation.getQuotationNumber());

        if ("CONVERTED".equals(quotation.getStatus())) {
            throw new BusinessException("Cannot update quotation " + quotation.getQuotationNumber() + " because it is already converted to an invoice.");
        }

        if (request.getCustomerId() != null) {
            Customer customer = customerRepository.findById(request.getCustomerId()).orElse(null);
            quotation.setCustomer(customer);
            if (customer != null) {
                quotation.setCustomerName(customer.getName());
                quotation.setCustomerPhone(customer.getPhone());
                quotation.setCustomerEmail(customer.getEmail());
            }
        } else if (request.getCustomerName() != null) {
            quotation.setCustomerName(request.getCustomerName());
        }

        if (request.getValidUntil() != null) quotation.setValidUntil(request.getValidUntil());
        if (request.getNotes() != null) quotation.setNotes(request.getNotes());
        if (request.getTerms() != null) quotation.setTerms(request.getTerms());

        if (request.getItems() != null && !request.getItems().isEmpty()) {
            quotation.getItems().clear();
            BigDecimal subtotal = BigDecimal.ZERO;
            for (CreateQuotationRequest.CreateQuotationItemRequest itemReq : request.getItems()) {
                Product product = itemReq.getProductId() != null
                        ? productRepository.findById(itemReq.getProductId()).orElse(null) : null;
                int qty = itemReq.getQuantity() != null && itemReq.getQuantity() > 0 ? itemReq.getQuantity() : 1;
                BigDecimal unitPrice = itemReq.getUnitPrice() != null ? itemReq.getUnitPrice() : BigDecimal.ZERO;
                BigDecimal discAmount = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal itemTotal = itemReq.getTotalPrice() != null ? itemReq.getTotalPrice()
                        : unitPrice.multiply(BigDecimal.valueOf(qty)).subtract(discAmount);

                QuotationItem item = QuotationItem.builder()
                        .product(product)
                        .productSku(itemReq.getProductSku())
                        .productName(itemReq.getProductName())
                        .quantity(qty)
                        .unitPrice(unitPrice)
                        .discountRate(itemReq.getDiscountRate() != null ? itemReq.getDiscountRate() : BigDecimal.ZERO)
                        .discountAmount(discAmount)
                        .totalPrice(itemTotal)
                        .build();

                quotation.addItem(item);
                subtotal = subtotal.add(itemTotal);
            }
            quotation.setSubtotal(subtotal);
            quotation.setTotalAmount(subtotal);
        } else if (request.getTotalAmount() != null) {
            quotation.setTotalAmount(request.getTotalAmount());
            quotation.setSubtotal(request.getTotalAmount());
        }

        Quotation saved = quotationRepository.save(quotation);
        String username = SecurityUtils.getCurrentUsername().orElse("system");
        auditLogService.log(
                "QUOTATION_UPDATE",
                "Quotation",
                saved.getQuotationNumber(),
                String.format("Quotation %s updated for customer '%s' totaling %s by %s",
                        saved.getQuotationNumber(),
                        saved.getCustomerName(),
                        saved.getTotalAmount(),
                        username)
        );
        return QuotationDto.from(saved);
    }

    @Transactional
    public void deleteQuotation(Long id) {
        SecurityUtils.enforceNoDelete("Quotation", id);
    }

    @Transactional
    public InvoiceDto convertToInvoice(Long id, Long warehouseId) {
        Quotation quotation = quotationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quotation", "id", id));

        if ("CONVERTED".equals(quotation.getStatus())) {
            throw new BusinessException("Quotation " + quotation.getQuotationNumber() + " has already been converted to invoice " + quotation.getConvertedInvoiceNumber());
        }

        Warehouse warehouse;
        if (warehouseId != null) {
            warehouse = warehouseRepository.findById(warehouseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", warehouseId));
        } else {
            warehouse = warehouseRepository.findByIsActiveTrue().stream().findFirst()
                    .orElseGet(() -> warehouseRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new BusinessException("No active warehouse found to fulfill quotation conversion")));
        }

        List<CreateInvoiceRequest.CreateInvoiceItemRequest> invoiceItems = new ArrayList<>();
        if (quotation.getItems() != null && !quotation.getItems().isEmpty()) {
            for (QuotationItem qi : quotation.getItems()) {
                Long pId = qi.getProduct() != null ? qi.getProduct().getId() : null;
                if (pId == null) {
                    Product defaultProd = productRepository.findByIsActiveTrue().stream().findFirst()
                            .orElseGet(() -> productRepository.findAll().stream().findFirst().orElse(null));
                    if (defaultProd != null) {
                        pId = defaultProd.getId();
                    }
                }
                if (pId != null) {
                    invoiceItems.add(CreateInvoiceRequest.CreateInvoiceItemRequest.builder()
                            .productId(pId)
                            .quantity(BigDecimal.valueOf(qi.getQuantity()))
                            .unitPrice(qi.getUnitPrice())
                            .discountRate(qi.getDiscountRate())
                            .discountAmount(qi.getDiscountAmount())
                            .build());
                }
            }
        }

        if (invoiceItems.isEmpty()) {
            Product defaultProd = productRepository.findByIsActiveTrue().stream().findFirst()
                    .orElseGet(() -> productRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new BusinessException("No product available to create invoice line item")));
            invoiceItems.add(CreateInvoiceRequest.CreateInvoiceItemRequest.builder()
                    .productId(defaultProd.getId())
                    .quantity(BigDecimal.ONE)
                    .unitPrice(quotation.getTotalAmount())
                    .discountRate(BigDecimal.ZERO)
                    .discountAmount(BigDecimal.ZERO)
                    .build());
        }

        CreateInvoiceRequest invoiceRequest = CreateInvoiceRequest.builder()
                .warehouseId(warehouse.getId())
                .customerId(quotation.getCustomer() != null ? quotation.getCustomer().getId() : null)
                .paymentType("CREDIT")
                .hold(false)
                .invoiceDate(LocalDate.now())
                .notes("Converted from Quotation " + quotation.getQuotationNumber())
                .items(invoiceItems)
                .build();

        InvoiceDto invoiceDto = invoiceService.createInvoice(invoiceRequest);

        quotation.setStatus("CONVERTED");
        quotation.setConvertedInvoiceId(invoiceDto.getId());
        quotation.setConvertedInvoiceNumber(invoiceDto.getInvoiceNumber());
        quotationRepository.save(quotation);

        auditLogService.log(
                "QUOTATION_CONVERT",
                "Quotation",
                quotation.getQuotationNumber(),
                String.format("Quotation %s converted to Commercial Invoice %s",
                        quotation.getQuotationNumber(),
                        invoiceDto.getInvoiceNumber())
        );

        return invoiceDto;
    }
}
