package com.nbh.erp.gtn.dto;

import com.nbh.erp.gtn.entity.Gtn;
import com.nbh.erp.gtn.entity.GtnItem;
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
public class GtnDto {
    private Long id;
    private String gtnNumber;
    private Long sourceWarehouseId;
    private String sourceWarehouseCode;
    private String sourceWarehouseName;
    private Long destinationWarehouseId;
    private String destinationWarehouseCode;
    private String destinationWarehouseName;
    private Long responsibleStaffId;
    private String responsibleStaffName;
    private String status;
    private String lastStatusReason;
    private LocalDate dispatchDate;
    private LocalDate receiveDate;
    private String notes;
    private List<GtnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static GtnDto from(Gtn gtn) {
        var sources = gtn.getItems().stream().map(GtnItem::getTransferSource).collect(java.util.stream.Collectors.toMap(warehouse -> warehouse.getId(), warehouse -> warehouse, (first, second) -> first));
        var destinations = gtn.getItems().stream().map(GtnItem::getTransferDestination).collect(java.util.stream.Collectors.toMap(warehouse -> warehouse.getId(), warehouse -> warehouse, (first, second) -> first));
        var source = sources.size() == 1 ? sources.values().iterator().next() : null;
        var destination = destinations.size() == 1 ? destinations.values().iterator().next() : null;
        return GtnDto.builder()
                .id(gtn.getId())
                .gtnNumber(gtn.getGtnNumber())
                .sourceWarehouseId(source == null ? null : source.getId())
                .sourceWarehouseCode(source == null ? null : source.getCode())
                .sourceWarehouseName(source == null ? null : source.getName())
                .destinationWarehouseId(destination == null ? null : destination.getId())
                .destinationWarehouseCode(destination == null ? null : destination.getCode())
                .destinationWarehouseName(destination == null ? null : destination.getName())
                .responsibleStaffId(gtn.getResponsibleStaff() == null ? null : gtn.getResponsibleStaff().getId())
                .responsibleStaffName(gtn.getResponsibleStaff() == null ? null : gtn.getResponsibleStaff().getFullName())
                .status("RECEIVED".equals(gtn.getStatus()) ? "TRANSFERRED" : gtn.getStatus())
                .lastStatusReason(gtn.getLastStatusReason())
                .dispatchDate(gtn.getDispatchDate())
                .receiveDate(gtn.getReceiveDate())
                .notes(gtn.getNotes())
                .createdBy(gtn.getCreatedBy())
                .createdAt(gtn.getCreatedAt())
                .items(gtn.getItems() != null
                        ? gtn.getItems().stream().map(GtnItemDto::from).collect(Collectors.toList())
                        : List.of())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GtnItemDto {
        private Long id;
        private Long productId;
        private String productSku;
        private String productName;
        private String unitOfMeasure;
        private Long sourceWarehouseId;
        private String sourceWarehouseName;
        private String sourceWarehouseCode;
        private Long destinationWarehouseId;
        private String destinationWarehouseName;
        private String destinationWarehouseCode;
        private BigDecimal quantityTransferred;
        private BigDecimal unitCost;
        private String notes;

        public static GtnItemDto from(GtnItem item) {
            return GtnItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productSku(item.getProduct().getSku())
                    .productName(item.getProduct().getName())
                    .unitOfMeasure(item.getProduct().getUnitOfMeasure())
                    .sourceWarehouseId(item.getTransferSource().getId())
                    .sourceWarehouseName(item.getTransferSource().getName())
                    .sourceWarehouseCode(item.getTransferSource().getCode())
                    .destinationWarehouseId(item.getTransferDestination().getId())
                    .destinationWarehouseName(item.getTransferDestination().getName())
                    .destinationWarehouseCode(item.getTransferDestination().getCode())
                    .quantityTransferred(item.getQuantityTransferred())
                    .unitCost(item.getUnitCost())
                    .notes(item.getNotes())
                    .build();
        }
    }
}
