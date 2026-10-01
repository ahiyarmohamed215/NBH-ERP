package com.nbh.erp.delivery.dto;

import com.nbh.erp.delivery.entity.Delivery;
import com.nbh.erp.sales.dto.InvoiceDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryDto {
    private Long id;
    private String deliveryNumber;

    private Long warehouseId;
    private String warehouseCode;
    private String warehouseName;

    private Long routeId;
    private String routeCode;
    private String routeName;

    private Long vehicleId;
    private String vehicleNumber;
    private String vehicleModel;

    // Assigned Staff 1: Driver
    private Long driverId;
    private String driverName;
    private String driverPhone;

    // Assigned Staff 2: Delivery Assistant / Helper
    private Long assistantStaffId;
    private String assistantStaffName;
    private String assistantStaffPhone;

    private LocalDate scheduledDate;
    private LocalDateTime departureTime;
    private LocalDateTime returnTime;
    private Integer tripDurationMinutes;

    private String status;
    private Integer totalInvoicesCount;
    private BigDecimal totalAmount;

    private Double startOdometer;
    private Double endOdometer;
    private String gpsTrackingCode;
    private String gpsLastLocation;

    private String notes;
    private String cancellationReason;
    private LocalDateTime cancellationDate;

    private List<Long> invoiceIds;
    private List<String> invoiceNumbers;
    private List<InvoiceDto> invoices;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DeliveryDto from(Delivery d) {
        return from(d, false);
    }

    public static DeliveryDto from(Delivery d, boolean includeInvoices) {
        List<Long> invIds = d.getInvoices() != null
                ? d.getInvoices().stream().map(com.nbh.erp.sales.entity.Invoice::getId).toList()
                : List.of();

        List<String> invNums = d.getInvoices() != null
                ? d.getInvoices().stream().map(com.nbh.erp.sales.entity.Invoice::getInvoiceNumber).toList()
                : List.of();

        List<InvoiceDto> invDtos = (includeInvoices && d.getInvoices() != null)
                ? d.getInvoices().stream().map(InvoiceDto::from).toList()
                : List.of();

        String driverName = d.getDriver() != null
                ? (d.getDriver().getFullName() != null ? d.getDriver().getFullName() : d.getDriver().getUsername()) : null;
        String driverPhone = d.getDriver() != null ? d.getDriver().getPhone() : null;

        String assistantName = d.getAssistantStaff() != null
                ? (d.getAssistantStaff().getFullName() != null ? d.getAssistantStaff().getFullName() : d.getAssistantStaff().getUsername()) : null;
        String assistantPhone = d.getAssistantStaff() != null ? d.getAssistantStaff().getPhone() : null;

        return DeliveryDto.builder()
                .id(d.getId())
                .deliveryNumber(d.getDeliveryNumber())
                .warehouseId(d.getWarehouse() != null ? d.getWarehouse().getId() : null)
                .warehouseCode(d.getWarehouse() != null ? d.getWarehouse().getCode() : null)
                .warehouseName(d.getWarehouse() != null ? d.getWarehouse().getName() : null)
                .routeId(d.getRoute() != null ? d.getRoute().getId() : null)
                .routeCode(d.getRoute() != null ? d.getRoute().getRouteCode() : null)
                .routeName(d.getRoute() != null ? d.getRoute().getRouteName() : null)
                .vehicleId(d.getVehicle() != null ? d.getVehicle().getId() : null)
                .vehicleNumber(d.getVehicle() != null ? d.getVehicle().getVehicleNumber() : d.getVehicleNumber())
                .vehicleModel(d.getVehicle() != null ? d.getVehicle().getModel() : null)
                .driverId(d.getDriver() != null ? d.getDriver().getId() : null)
                .driverName(driverName)
                .driverPhone(driverPhone)
                .assistantStaffId(d.getAssistantStaff() != null ? d.getAssistantStaff().getId() : null)
                .assistantStaffName(assistantName)
                .assistantStaffPhone(assistantPhone)
                .scheduledDate(d.getScheduledDate())
                .departureTime(d.getDepartureTime())
                .returnTime(d.getReturnTime())
                .tripDurationMinutes(d.getTripDurationMinutes())
                .status(d.getStatus())
                .totalInvoicesCount(d.getTotalInvoicesCount() != null ? d.getTotalInvoicesCount() : invIds.size())
                .totalAmount(d.getTotalAmount())
                .startOdometer(d.getStartOdometer())
                .endOdometer(d.getEndOdometer())
                .gpsTrackingCode(d.getGpsTrackingCode())
                .gpsLastLocation(d.getGpsLastLocation())
                .notes(d.getNotes())
                .cancellationReason(d.getCancellationReason())
                .cancellationDate(d.getCancellationDate())
                .invoiceIds(invIds)
                .invoiceNumbers(invNums)
                .invoices(invDtos)
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .build();
    }
}
