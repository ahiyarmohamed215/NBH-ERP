package com.nbh.erp.sales.dto;

import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceDto {
    private Long id;
    private String invoiceNumber;
    private Long customerId;
    private String customerCode;
    private String customerName;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private Long salesmanId;
    private String salesmanName;
    private String status;
    private String paymentType;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal taxRate;
    private BigDecimal taxAmount;
    private BigDecimal netTotal;
    private BigDecimal paidAmount;
    private BigDecimal balanceAmount;
    private LocalDate invoiceDate;
    private String notes;
    private List<InvoiceItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static InvoiceDto from(Invoice inv) {
        return InvoiceDto.builder()
                .id(inv.getId())
                .invoiceNumber(inv.getInvoiceNumber())
                .customerId(inv.getCustomer().getId())
                .customerCode(inv.getCustomer().getCustomerCode())
                .customerName(inv.getCustomer().getName())
                .warehouseId(inv.getWarehouse().getId())
                .warehouseCode(inv.getWarehouse().getCode())
                .warehouseName(inv.getWarehouse().getName())
                .salesmanId(inv.getSalesman() != null ? inv.getSalesman().getId() : null)
                .salesmanName(inv.getSalesman() != null ? inv.getSalesman().getName() : null)
                .status(inv.getStatus())
                .paymentType(inv.getPaymentType())
                .subtotal(inv.getSubtotal())
                .discountAmount(inv.getDiscountAmount())
                .taxRate(inv.getTaxRate())
                .taxAmount(inv.getTaxAmount())
                .netTotal(inv.getNetTotal())
                .paidAmount(inv.getPaidAmount())
                .balanceAmount(inv.getBalanceAmount())
                .invoiceDate(inv.getInvoiceDate())
                .notes(inv.getNotes())
                .createdBy(inv.getCreatedBy())
                .createdAt(inv.getCreatedAt())
                .items(inv.getItems() != null
                        ? inv.getItems().stream().map(InvoiceItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvoiceItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productBarcode;
        private String productName;
        private String unitOfMeasure;
        private BigDecimal quantity;
        private BigDecimal unitPrice;
        private BigDecimal costPrice;
        private BigDecimal discountRate;
        private BigDecimal discountAmount;
        private BigDecimal totalPrice;

        public static InvoiceItemDto from(InvoiceItem item) {
            return InvoiceItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productBarcode(item.getProduct().getBarcode())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .quantity(item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .costPrice(item.getCostPrice())
                    .discountRate(item.getDiscountRate())
                    .discountAmount(item.getDiscountAmount())
                    .totalPrice(item.getTotalPrice())
                    .build();
        }
    }
}
