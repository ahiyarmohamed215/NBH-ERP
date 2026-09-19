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
    private String status;
    private LocalDate dispatchDate;
    private LocalDate receiveDate;
    private String notes;
    private List<GtnItemDto> items;
    private String createdBy;
    private LocalDateTime createdAt;

    public static GtnDto from(Gtn gtn) {
        return GtnDto.builder()
                .id(gtn.getId())
                .gtnNumber(gtn.getGtnNumber())
                .sourceWarehouseId(gtn.getSourceWarehouse().getId())
                .sourceWarehouseCode(gtn.getSourceWarehouse().getCode())
                .sourceWarehouseName(gtn.getSourceWarehouse().getName())
                .destinationWarehouseId(gtn.getDestinationWarehouse().getId())
                .destinationWarehouseCode(gtn.getDestinationWarehouse().getCode())
                .destinationWarehouseName(gtn.getDestinationWarehouse().getName())
                .status(gtn.getStatus())
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
                    .quantityTransferred(item.getQuantityTransferred())
                    .unitCost(item.getUnitCost())
                    .notes(item.getNotes())
                    .build();
        }
    }
}
