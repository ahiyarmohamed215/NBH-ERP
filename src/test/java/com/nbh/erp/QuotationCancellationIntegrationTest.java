package com.nbh.erp;

import com.nbh.erp.audit.repository.AuditLogRepository;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.quotation.dto.CreateQuotationRequest;
import com.nbh.erp.quotation.dto.QuotationDto;
import com.nbh.erp.quotation.repository.QuotationRepository;
import com.nbh.erp.quotation.service.QuotationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
@WithMockUser(username = "admin_user", authorities = {"ROLE_ADMIN", "SALES_CREATE", "QUOTATION_MANAGE"})
class QuotationCancellationIntegrationTest {

    @Autowired
    private QuotationService quotationService;

    @Autowired
    private QuotationRepository quotationRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private Customer testCustomer;
    private Product testProduct;

    @BeforeEach
    void setUp() {
        testCustomer = customerRepository.save(Customer.builder()
                .name("Apex Test Customer " + System.currentTimeMillis())
                .customerCode("CUST-" + System.currentTimeMillis())
                .isActive(true)
                .build());

        testProduct = productRepository.save(Product.builder()
                .name("Brake Disc Test")
                .sku("SKU-TEST-" + System.currentTimeMillis())
                .sellingPrice(BigDecimal.valueOf(5000.00))
                .costPrice(BigDecimal.valueOf(3500.00))
                .isActive(true)
                .build());
    }

    @Test
    void createAndCancelQuotationWithAuditReason() {
        CreateQuotationRequest createReq = CreateQuotationRequest.builder()
                .customerId(testCustomer.getId())
                .customerName(testCustomer.getName())
                .quotationDate(LocalDate.now())
                .validUntil(LocalDate.now().plusDays(14))
                .discountAmount(BigDecimal.valueOf(500.00))
                .items(List.of(
                        CreateQuotationRequest.CreateQuotationItemRequest.builder()
                                .productId(testProduct.getId())
                                .productSku(testProduct.getSku())
                                .productName(testProduct.getName())
                                .quantity(2)
                                .unitPrice(BigDecimal.valueOf(5000.00))
                                .discountAmount(BigDecimal.valueOf(500.00))
                                .totalPrice(BigDecimal.valueOf(9500.00))
                                .build()
                ))
                .build();

        QuotationDto created = quotationService.createQuotation(createReq);
        assertNotNull(created.getId());
        assertEquals("PENDING", created.getStatus());
        assertEquals(0, BigDecimal.valueOf(9000.00).compareTo(created.getTotalAmount()));

        // Cancel quotation
        String reason = "Client decided on alternative brand";
        QuotationDto cancelled = quotationService.cancelQuotation(created.getId(), reason);

        assertEquals("CANCELLED", cancelled.getStatus());
        assertEquals(reason, cancelled.getCancelReason());
        assertEquals("admin_user", cancelled.getCancelledBy());
        assertNotNull(cancelled.getCancelledAt());

        // Attempting to cancel already cancelled quotation should fail
        assertThrows(BusinessException.class, () ->
                quotationService.cancelQuotation(created.getId(), "Trying again")
        );

        // Attempting to update cancelled quotation should fail
        assertThrows(BusinessException.class, () ->
                quotationService.updateQuotation(created.getId(), createReq)
        );

        // Attempting to convert cancelled quotation should fail
        assertThrows(BusinessException.class, () ->
                quotationService.convertToInvoice(created.getId(), null)
        );
    }

    @Test
    void cancellingWithoutReasonThrowsBusinessException() {
        CreateQuotationRequest createReq = CreateQuotationRequest.builder()
                .customerId(testCustomer.getId())
                .customerName(testCustomer.getName())
                .totalAmount(BigDecimal.valueOf(1000.00))
                .build();

        QuotationDto created = quotationService.createQuotation(createReq);

        assertThrows(BusinessException.class, () ->
                quotationService.cancelQuotation(created.getId(), "   ")
        );
        assertThrows(BusinessException.class, () ->
                quotationService.cancelQuotation(created.getId(), null)
        );
    }
}
