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
    private String paymentMethod;
    private BigDecimal returnedAmount;
    private String deliveryStatus;
    private Long deliveryId;
    private String deliveryNumber;
    private String deliveryRouteName;
    private String vehicleNumber;
    private String driverName;
    private String assistantStaffName;
    private LocalDate deliveryDate;
    private String deliveryNotes;
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
        Long delId = inv.getDelivery() != null ? inv.getDelivery().getId() : null;
        String delNumber = inv.getDelivery() != null ? inv.getDelivery().getDeliveryNumber() : null;
        String delRouteName = inv.getDelivery() != null && inv.getDelivery().getRoute() != null ? inv.getDelivery().getRoute().getRouteName() : null;
        String vehNum = inv.getDelivery() != null ? inv.getDelivery().getVehicleNumber() : null;
        String driver = inv.getDelivery() != null && inv.getDelivery().getDriver() != null
                ? (inv.getDelivery().getDriver().getFullName() != null ? inv.getDelivery().getDriver().getFullName() : inv.getDelivery().getDriver().getUsername()) : null;
        String assistant = inv.getDelivery() != null && inv.getDelivery().getAssistantStaff() != null
                ? (inv.getDelivery().getAssistantStaff().getFullName() != null ? inv.getDelivery().getAssistantStaff().getFullName() : inv.getDelivery().getAssistantStaff().getUsername()) : null;

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
                .salesmanName(inv.getSalesman() != null ? (inv.getSalesman().getFullName() != null ? inv.getSalesman().getFullName() : inv.getSalesman().getUsername()) : null)
                .status(inv.getStatus())
                .paymentType(inv.getPaymentType())
                .paymentMethod(inv.getPaymentMethod())
                .returnedAmount(inv.getReturnedAmount())
                .deliveryStatus(inv.getDeliveryStatus() != null ? inv.getDeliveryStatus() : "PENDING")
                .deliveryId(delId)
                .deliveryNumber(delNumber)
                .deliveryRouteName(delRouteName)
                .vehicleNumber(vehNum)
                .driverName(driver)
                .assistantStaffName(assistant)
                .deliveryDate(inv.getDeliveryDate())
                .deliveryNotes(inv.getDeliveryNotes())
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
