package com.nbh.erp.quotation.dto;

import com.nbh.erp.quotation.entity.Quotation;
import com.nbh.erp.quotation.entity.QuotationItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotationDto {

    private Long id;
    private String quotationNumber;
    private String quotationNo; // Frontend alias
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private LocalDate quotationDate;
    private String date; // Frontend alias
    private LocalDate validUntil;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private String status;
    private Long convertedInvoiceId;
    private String convertedInvoiceNumber;
    private String notes;
    private String terms;
    private LocalDateTime createdAt;
    private String createdBy;

    @Builder.Default
    private List<QuotationItemDto> items = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuotationItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal discountRate;
        private BigDecimal discountAmount;
        private BigDecimal totalPrice;

        public static QuotationItemDto from(QuotationItem item) {
            if (item == null) return null;
            return QuotationItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct() != null ? item.getProduct().getId() : item.getProduct() != null ? item.getProduct().getId() : null)
                    .productSku(item.getProductSku())
                    .productName(item.getProductName())
                    .quantity(item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .discountRate(item.getDiscountRate())
                    .discountAmount(item.getDiscountAmount())
                    .totalPrice(item.getTotalPrice())
                    .build();
        }
    }

    public static QuotationDto from(Quotation q) {
        if (q == null) return null;
        String custName = q.getCustomer() != null ? q.getCustomer().getName() : (q.getCustomerName() != null ? q.getCustomerName() : "Walk-in");
        Long custId = q.getCustomer() != null ? q.getCustomer().getId() : null;

        List<QuotationItemDto> itemDtos = new ArrayList<>();
        if (q.getItems() != null) {
            for (QuotationItem it : q.getItems()) {
                itemDtos.add(QuotationItemDto.from(it));
            }
        }

        return QuotationDto.builder()
                .id(q.getId())
                .quotationNumber(q.getQuotationNumber())
                .quotationNo(q.getQuotationNumber())
                .customerId(custId)
                .customerName(custName)
                .customerPhone(q.getCustomerPhone())
                .customerEmail(q.getCustomerEmail())
                .quotationDate(q.getQuotationDate())
                .date(q.getQuotationDate() != null ? q.getQuotationDate().toString() : null)
                .validUntil(q.getValidUntil())
                .subtotal(q.getSubtotal())
                .discountAmount(q.getDiscountAmount())
                .taxAmount(q.getTaxAmount())
                .totalAmount(q.getTotalAmount())
                .status(q.getStatus())
                .convertedInvoiceId(q.getConvertedInvoiceId())
                .convertedInvoiceNumber(q.getConvertedInvoiceNumber())
                .notes(q.getNotes())
                .terms(q.getTerms())
                .createdAt(q.getCreatedAt())
                .createdBy(q.getCreatedBy())
                .items(itemDtos)
                .build();
    }
}
