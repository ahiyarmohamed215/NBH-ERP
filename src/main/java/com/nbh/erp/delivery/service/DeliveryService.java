package com.nbh.erp.delivery.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.delivery.dto.CreateDeliveryRequest;
import com.nbh.erp.delivery.dto.DeliveryDto;
import com.nbh.erp.delivery.dto.DeliverySummaryDto;
import com.nbh.erp.delivery.dto.UpdateDeliveryStatusRequest;
import com.nbh.erp.delivery.entity.Delivery;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.entity.Vehicle;
import com.nbh.erp.delivery.repository.DeliveryRepository;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final DeliveryRepository deliveryRepository;
    private final DeliveryRouteRepository routeRepository;
    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final InvoiceRepository invoiceRepository;
    private final AuditLogService auditLogService;
    private final com.nbh.erp.sequence.service.DocumentSequenceService sequences;

    @Transactional(readOnly = true)
    public List<DeliveryDto> searchDeliveries(String status, Long routeId, Long vehicleId, LocalDate startDate, LocalDate endDate, String search) {
        return deliveryRepository.searchDeliveries(status, routeId, vehicleId, startDate, endDate, search)
                .stream()
                .map(d -> DeliveryDto.from(d, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public DeliveryDto getDeliveryById(Long id) {
        Delivery d = deliveryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));
        return DeliveryDto.from(d, true);
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> getPendingInvoicesForDelivery() {
        return invoiceRepository.findAll().stream()
                .filter(inv -> com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(inv.getStatus()) &&
                        (inv.getDelivery() == null || "PENDING".equalsIgnoreCase(inv.getDeliveryStatus())))
                .map(InvoiceDto::from)
                .toList();
    }

    @Transactional
    public DeliveryDto createDelivery(CreateDeliveryRequest req) {
        var ticket=idempotency.reserve("createDelivery",req);
        if(ticket!=null && ticket.getResourceId()!=null) return getDeliveryById(ticket.getResourceId());

        // Validation: Two assigned staff members are required
        if (req.getDriverId().equals(req.getAssistantStaffId())) {
            throw new BusinessException("Primary driver and assistant staff must be two different staff members");
        }

        for (Long staffId : java.util.stream.Stream.of(req.getDriverId(), req.getAssistantStaffId()).sorted().toList()) {
            userRepository.findByIdForUpdate(staffId).orElseThrow(() -> new BusinessException("Unknown staff member"));
            if (deliveryRepository.activeTripsForStaff(staffId) > 0) throw new BusinessException("Staff member is already assigned to an active trip");
        }
        User driver = userRepository.findById(req.getDriverId())
                .orElseThrow(() -> new ResourceNotFoundException("User (Driver)", "id", req.getDriverId()));

        User assistantStaff = userRepository.findById(req.getAssistantStaffId())
                .orElseThrow(() -> new ResourceNotFoundException("User (Assistant Staff)", "id", req.getAssistantStaffId()));

        Vehicle vehicle = null;
        if (req.getVehicleId() != null) {
            vehicle = vehicleRepository.findByIdForUpdate(req.getVehicleId()).orElse(null);
        }

        DeliveryRoute route = null;
        if (req.getRouteId() != null) {
            route = routeRepository.findById(req.getRouteId()).orElse(null);
        }

        Warehouse warehouse = null;
        if (req.getWarehouseId() != null) {
            warehouse = warehouseRepository.findById(req.getWarehouseId()).orElse(null);
        }

        // Validate invoices
        List<Invoice> selectedInvoices = req.getInvoiceIds().stream().distinct().sorted().map(id -> invoiceRepository.findByIdForUpdate(id).orElseThrow(() -> new BusinessException("Unknown invoice: " + id))).toList();
        if (selectedInvoices.isEmpty()) {
            throw new BusinessException("At least one valid invoice must be selected for delivery");
        }

        for (Invoice inv : selectedInvoices) {
            if (!com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(inv.getStatus()) || inv.getDelivery() != null) {
                throw new BusinessException(String.format("Invoice '%s' is already in transit under delivery trip '%s'",
                        inv.getInvoiceNumber(), inv.getDelivery()!=null ? inv.getDelivery().getDeliveryNumber() : "ineligible"));
            }
        }

        if(!Boolean.TRUE.equals(driver.getIsActive()) || !Boolean.TRUE.equals(assistantStaff.getIsActive())) throw new BusinessException("Assigned staff must be active");
        if(vehicle!=null && (!Boolean.TRUE.equals(vehicle.getIsActive()) || !"AVAILABLE".equals(vehicle.getStatus()))) throw new BusinessException("Vehicle is not available");
        if(req.getVehicleId()!=null && vehicle==null || req.getRouteId()!=null && route==null || req.getWarehouseId()!=null && warehouse==null) throw new BusinessException("Unknown vehicle, route, or warehouse");
        if(warehouse!=null) for(Invoice inv:selectedInvoices) if(!warehouse.getId().equals(inv.getWarehouse().getId())) throw new BusinessException("Invoice warehouse does not match trip");
        String deliveryNumber=sequences.getNextNumber("DEL");

        BigDecimal totalAmount = selectedInvoices.stream()
                .map(Invoice::getNetTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Delivery delivery = Delivery.builder()
                .deliveryNumber(deliveryNumber)
                .warehouse(warehouse)
                .route(route)
                .vehicle(vehicle)
                .vehicleNumber(vehicle != null ? vehicle.getVehicleNumber() : null)
                .driver(driver)
                .assistantStaff(assistantStaff)
                .scheduledDate(req.getScheduledDate())
                .departureTime(req.getDepartureTime())
                .returnTime(req.getReturnTime())
                .status("SCHEDULED")
                .totalInvoicesCount(selectedInvoices.size())
                .totalAmount(totalAmount)
                .startOdometer(req.getStartOdometer())
                .endOdometer(req.getEndOdometer())
                .gpsTrackingCode(req.getGpsTrackingCode())
                .notes(req.getNotes())
                .build();

        Delivery saved = deliveryRepository.save(delivery);

        // Update assigned invoices
        for (Invoice inv : selectedInvoices) {
            inv.setDelivery(saved);
            inv.setDeliveryStatus("OUT_FOR_DELIVERY");
            invoiceRepository.save(inv);
        }

        if (vehicle != null) {
            vehicle.setStatus("ON_DELIVERY");
            vehicleRepository.save(vehicle);
        }

        auditLogService.log(
                "DELIVERY_CREATE",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' created with %d invoices (Driver: %s, Assistant: %s)",
                        saved.getDeliveryNumber(), selectedInvoices.size(), driver.getUsername(), assistantStaff.getUsername())
        );

        saved.setInvoices(selectedInvoices);
        return idempotency.complete(ticket,saved.getId(),DeliveryDto.from(saved,true));
    }

    @Transactional
    public DeliveryDto dispatchDelivery(Long id, UpdateDeliveryStatusRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));

        if ("CANCELLED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot dispatch a cancelled delivery trip");
        }
        if ("DELIVERED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Delivery trip has already been completed");
        }

        if(!"SCHEDULED".equals(delivery.getStatus())) throw new BusinessException("Only scheduled trips can be dispatched");
        LocalDateTime departTime = (req != null && req.getDepartureTime() != null)
                ? req.getDepartureTime()
                : (delivery.getDepartureTime() != null ? delivery.getDepartureTime() : LocalDateTime.now());

        delivery.setDepartureTime(departTime);
        delivery.setStatus("IN_TRANSIT");

        if (req != null && req.getStartOdometer() != null) {
            delivery.setStartOdometer(req.getStartOdometer());
        }
        if (req != null && req.getNotes() != null) {
            delivery.setNotes(req.getNotes());
        }

        if (delivery.getVehicle() != null) {
            delivery.getVehicle().setStatus("ON_DELIVERY");
            vehicleRepository.save(delivery.getVehicle());
        }

        for (Invoice inv : delivery.getInvoices()) {
            inv.setDeliveryStatus("OUT_FOR_DELIVERY");
            invoiceRepository.save(inv);
        }

        Delivery saved = deliveryRepository.save(delivery);

        auditLogService.log(
                "DELIVERY_DISPATCH",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' dispatched on route at %s", saved.getDeliveryNumber(), departTime)
        );

        return DeliveryDto.from(saved, true);
    }

    @Transactional
    public DeliveryDto completeDelivery(Long id, UpdateDeliveryStatusRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));

        if ("CANCELLED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot complete a cancelled delivery trip");
        }

        if(!"IN_TRANSIT".equals(delivery.getStatus())) throw new BusinessException("Only in-transit trips can be completed");
        LocalDateTime retTime = (req != null && req.getReturnTime() != null)
                ? req.getReturnTime()
                : LocalDateTime.now();

        if(retTime.isBefore(delivery.getDepartureTime())) throw new BusinessException("Return time precedes departure");
        if(req!=null && req.getEndOdometer()!=null && delivery.getStartOdometer()!=null && req.getEndOdometer()<delivery.getStartOdometer()) throw new BusinessException("Odometer cannot decrease");
        delivery.setReturnTime(retTime);
        delivery.setStatus("DELIVERED");

        if (delivery.getDepartureTime() == null) {
            delivery.setDepartureTime(retTime.minusHours(2));
        }

        long minutes = Duration.between(delivery.getDepartureTime(), retTime).toMinutes();
        delivery.setTripDurationMinutes((int) Math.max(1, minutes));

        if (req != null && req.getEndOdometer() != null) {
            delivery.setEndOdometer(req.getEndOdometer());
        }
        if (req != null && req.getGpsLastLocation() != null) {
            delivery.setGpsLastLocation(req.getGpsLastLocation());
        }

        if (delivery.getVehicle() != null) {
            delivery.getVehicle().setStatus("AVAILABLE");
            vehicleRepository.save(delivery.getVehicle());
        }

        // Mark all invoices as DELIVERED
        for (Invoice inv : delivery.getInvoices()) {
            inv.setDeliveryStatus("DELIVERED");
            inv.setDeliveryDate(retTime.toLocalDate());
            invoiceRepository.save(inv);
        }

        Delivery saved = deliveryRepository.save(delivery);

        auditLogService.log(
                "DELIVERY_COMPLETE",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' completed successfully (Trip duration: %d mins)",
                        saved.getDeliveryNumber(), saved.getTripDurationMinutes())
        );

        return DeliveryDto.from(saved, true);
    }

    @Transactional
    public DeliveryDto cancelDelivery(Long id, UpdateDeliveryStatusRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));

        if ("DELIVERED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot cancel an already completed delivery trip");
        }

        if("CANCELLED".equals(delivery.getStatus())) throw new BusinessException("Trip already cancelled");
        delivery.setStatus("CANCELLED");
        delivery.setCancellationDate(LocalDateTime.now());
        delivery.setCancellationReason(req != null && req.getCancellationReason() != null
                ? req.getCancellationReason()
                : "Cancelled by distribution controller");

        if (delivery.getVehicle() != null) {
            delivery.getVehicle().setStatus("AVAILABLE");
            vehicleRepository.save(delivery.getVehicle());
        }

        // Release invoices back to PENDING so they can be rescheduled
        for (Invoice inv : delivery.getInvoices()) {
            inv.setDelivery(null);
            inv.setDeliveryStatus("PENDING");
            invoiceRepository.save(inv);
        }

        Delivery saved = deliveryRepository.save(delivery);

        auditLogService.log(
                "DELIVERY_CANCEL",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' cancelled. Reason: %s", saved.getDeliveryNumber(), saved.getCancellationReason())
        );

        return DeliveryDto.from(saved, false);
    }

    @Transactional(readOnly = true)
    public DeliverySummaryDto getSummaryMetrics() {
        long total = deliveryRepository.count();
        long scheduled = deliveryRepository.countByStatus("SCHEDULED");
        long inTransit = deliveryRepository.countByStatus("IN_TRANSIT");
        long delivered = deliveryRepository.countByStatus("DELIVERED");
        long cancelled = deliveryRepository.countByStatus("CANCELLED");
        long today = deliveryRepository.countByScheduledDate(LocalDate.now());

        long pendingInvoices = invoiceRepository.findAll().stream()
                .filter(inv -> com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(inv.getStatus()) &&
                        (inv.getDelivery() == null || "PENDING".equalsIgnoreCase(inv.getDeliveryStatus())))
                .count();

        BigDecimal deliveredAmount = deliveryRepository.findByStatus("DELIVERED").stream()
                .map(Delivery::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return DeliverySummaryDto.builder()
                .totalDeliveries(total)
                .scheduledCount(scheduled)
                .inTransitCount(inTransit)
                .deliveredCount(delivered)
                .cancelledCount(cancelled)
                .todayDeliveriesCount(today)
                .pendingInvoicesForDeliveryCount(pendingInvoices)
                .totalDeliveredAmount(deliveredAmount)
                .build();
    }
}
