package com.nbh.erp.salesreturn.dto;

import com.nbh.erp.salesreturn.entity.SalesReturn;
import com.nbh.erp.salesreturn.entity.SalesReturnItem;
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
public class SalesReturnDto {
    private Long id;
    private String returnNumber;
    private Long invoiceId;
    private String invoiceNumber;
    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private Long customerId;
    private String customerCode;
    private String customerName;
    private String status;
    private String returnType;
    private BigDecimal totalAmount;
    private LocalDate returnDate;
    private String reason;
    private List<SalesReturnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static SalesReturnDto from(SalesReturn sr) {
        return SalesReturnDto.builder()
                .id(sr.getId())
                .returnNumber(sr.getReturnNumber())
                .invoiceId(sr.getInvoice().getId())
                .invoiceNumber(sr.getInvoice().getInvoiceNumber())
                .warehouseId(sr.getWarehouse().getId())
                .warehouseCode(sr.getWarehouse().getCode())
                .warehouseName(sr.getWarehouse().getName())
                .customerId(sr.getCustomer().getId())
                .customerCode(sr.getCustomer().getCustomerCode())
                .customerName(sr.getCustomer().getName())
                .status(sr.getStatus())
                .returnType(sr.getReturnType())
                .totalAmount(sr.getTotalAmount())
                .returnDate(sr.getReturnDate())
                .reason(sr.getReason())
                .createdBy(sr.getCreatedBy())
                .createdAt(sr.getCreatedAt())
                .items(sr.getItems() != null
                        ? sr.getItems().stream().map(SalesReturnItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesReturnItemDto {
        private Long id;
        private Long invoiceItemId;
        private Long productId;
        private String productSku;
        private String productName;
        private String unitOfMeasure;
        private BigDecimal quantity;
        private BigDecimal unitPrice;
        private String conditionType;
        private BigDecimal totalAmount;
        private Boolean isRestocked;

        public static SalesReturnItemDto from(SalesReturnItem item) {
            return SalesReturnItemDto.builder()
                    .id(item.getId())
                    .invoiceItemId(item.getInvoiceItemId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .quantity(item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .conditionType(item.getConditionType())
                    .totalAmount(item.getTotalAmount())
                    .isRestocked(item.getIsRestocked())
                    .build();
        }
    }
}
