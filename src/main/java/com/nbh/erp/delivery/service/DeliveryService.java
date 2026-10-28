package com.nbh.erp.delivery.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.delivery.dto.CreateDeliveryRequest;
import com.nbh.erp.delivery.dto.RescheduleDeliveryRequest;
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
                .filter(inv -> Boolean.TRUE.equals(inv.getCustomer().getIsActive()))
                .filter(inv -> com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(inv.getStatus()) &&
                        (inv.getDelivery() == null || "PENDING".equalsIgnoreCase(inv.getDeliveryStatus())))
                .map(InvoiceDto::from)
                .toList();
    }

    @Transactional
    public DeliveryDto createDelivery(CreateDeliveryRequest req) {
        var ticket = idempotency.reserve("createDelivery", req);
        if (ticket != null && ticket.getResourceId() != null) return getDeliveryById(ticket.getResourceId());

        boolean isDraft = req.isDraft();

        if (isDraft) {
            boolean hasAny = req.getWarehouseId() != null
                    || req.getRouteId() != null
                    || req.getVehicleId() != null
                    || req.getDriverId() != null
                    || req.getAssistantStaffId() != null
                    || req.getScheduledDate() != null
                    || (req.getNotes() != null && !req.getNotes().trim().isEmpty())
                    || req.getStartOdometer() != null
                    || (req.getInvoiceIds() != null && !req.getInvoiceIds().isEmpty())
                    || (req.getSpecialInvoiceIds() != null && !req.getSpecialInvoiceIds().isEmpty());
            if (!hasAny) {
                throw new BusinessException("Fill at least one input before saving a delivery draft");
            }
        } else {
            if (req.getDriverId() == null || req.getAssistantStaffId() == null) {
                throw new BusinessException("Primary driver and assistant staff are required");
            }
            if (req.getScheduledDate() == null) {
                throw new BusinessException("Scheduled date is required");
            }
            if (req.getInvoiceIds() == null || req.getInvoiceIds().isEmpty()) {
                throw new BusinessException("At least one valid invoice must be selected for delivery");
            }
        }

        if (req.getDriverId() != null && req.getAssistantStaffId() != null && req.getDriverId().equals(req.getAssistantStaffId())) {
            throw new BusinessException("Primary driver and assistant staff must be two different staff members");
        }

        User driver = null;
        if (req.getDriverId() != null) {
            if (!isDraft) {
                userRepository.findByIdForUpdate(req.getDriverId()).orElseThrow(() -> new BusinessException("Unknown staff member"));
                if (deliveryRepository.activeTripsForStaff(req.getDriverId()) > 0) throw new BusinessException("Staff member is already assigned to an active trip");
            }
            driver = userRepository.findById(req.getDriverId())
                    .orElseThrow(() -> new ResourceNotFoundException("User (Driver)", "id", req.getDriverId()));
            if (!isDraft && !Boolean.TRUE.equals(driver.getIsActive())) throw new BusinessException("Assigned staff must be active");
        }

        User assistantStaff = null;
        if (req.getAssistantStaffId() != null) {
            if (!isDraft) {
                userRepository.findByIdForUpdate(req.getAssistantStaffId()).orElseThrow(() -> new BusinessException("Unknown staff member"));
                if (deliveryRepository.activeTripsForStaff(req.getAssistantStaffId()) > 0) throw new BusinessException("Staff member is already assigned to an active trip");
            }
            assistantStaff = userRepository.findById(req.getAssistantStaffId())
                    .orElseThrow(() -> new ResourceNotFoundException("User (Assistant Staff)", "id", req.getAssistantStaffId()));
            if (!isDraft && !Boolean.TRUE.equals(assistantStaff.getIsActive())) throw new BusinessException("Assigned staff must be active");
        }

        Vehicle vehicle = null;
        if (req.getVehicleId() != null) {
            vehicle = vehicleRepository.findByIdForUpdate(req.getVehicleId()).orElse(null);
            if (vehicle == null) throw new BusinessException("Unknown vehicle");
            if (!isDraft && (!Boolean.TRUE.equals(vehicle.getIsActive()) || !"AVAILABLE".equals(vehicle.getStatus()))) {
                throw new BusinessException("Vehicle is not available");
            }
        }

        DeliveryRoute route = null;
        if (req.getRouteId() != null) {
            route = routeRepository.findById(req.getRouteId()).orElse(null);
            if (route == null) throw new BusinessException("Unknown route");
            if (!isDraft && (route.isDeleted() || !Boolean.TRUE.equals(route.getIsActive()))) {
                throw new BusinessException("Route is not available");
            }
        }

        Warehouse warehouse = null;
        if (req.getWarehouseId() != null) {
            warehouse = warehouseRepository.findById(req.getWarehouseId()).orElse(null);
            if (warehouse == null) throw new BusinessException("Unknown warehouse");
        }

        List<Invoice> selectedInvoices = List.of();
        if (req.getInvoiceIds() != null && !req.getInvoiceIds().isEmpty()) {
            selectedInvoices = req.getInvoiceIds().stream().distinct().sorted()
                    .map(id -> invoiceRepository.findByIdForUpdate(id).orElseThrow(() -> new BusinessException("Unknown invoice: " + id)))
                    .toList();
            if (warehouse == null && selectedInvoices.get(0).getWarehouse() != null) {
                warehouse = selectedInvoices.get(0).getWarehouse();
            }
            for (Invoice inv : selectedInvoices) {
                com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer());
                if (!isDraft && (!com.nbh.erp.sales.service.InvoiceBalances.POSTED.contains(inv.getStatus()) || inv.getDelivery() != null)) {
                    throw new BusinessException(String.format("Invoice '%s' is already in transit under delivery trip '%s'",
                            inv.getInvoiceNumber(), inv.getDelivery() != null ? inv.getDelivery().getDeliveryNumber() : "ineligible"));
                }
            }
            if (req.getWarehouseId() != null && warehouse != null && !isDraft) {
                for (Invoice inv : selectedInvoices) {
                    if (!warehouse.getId().equals(inv.getWarehouse().getId())) throw new BusinessException("Invoice warehouse does not match trip");
                }
            }
        }

        String deliveryNumber = sequences.getNextNumber("DEL");
        BigDecimal totalAmount = selectedInvoices.stream()
                .map(Invoice::getNetTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String specialInvoiceIds = null;
        if (req.getSpecialInvoiceIds() != null && !req.getSpecialInvoiceIds().isEmpty()) {
            specialInvoiceIds = req.getSpecialInvoiceIds().stream()
                    .distinct()
                    .map(String::valueOf)
                    .collect(java.util.stream.Collectors.joining(","));
        }

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
                .status(isDraft ? "DRAFT" : "SCHEDULED")
                .totalInvoicesCount(selectedInvoices.size())
                .totalAmount(totalAmount)
                .startOdometer(req.getStartOdometer())
                .endOdometer(req.getEndOdometer())
                .gpsTrackingCode(req.getGpsTrackingCode())
                .notes(req.getNotes())
                .specialInvoiceIds(specialInvoiceIds)
                .build();

        Delivery saved = deliveryRepository.save(delivery);

        if (!isDraft) {
            for (Invoice inv : selectedInvoices) {
                com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer());
                inv.setDelivery(saved);
                inv.setDeliveryStatus("OUT_FOR_DELIVERY");
                invoiceRepository.save(inv);
            }
            if (vehicle != null) {
                vehicle.setStatus("ON_DELIVERY");
                vehicleRepository.save(vehicle);
            }
        }

        auditLogService.log(
                isDraft ? "DELIVERY_DRAFT_CREATE" : "DELIVERY_CREATE",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' created (Status: %s)", saved.getDeliveryNumber(), saved.getStatus())
        );

        saved.setInvoices(selectedInvoices);
        return idempotency.complete(ticket, saved.getId(), DeliveryDto.from(saved, true));
    }

    @Transactional
    public DeliveryDto dispatchDelivery(Long id, UpdateDeliveryStatusRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));
        delivery.getInvoices().forEach(inv -> com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer()));

        if ("CANCELLED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot dispatch a cancelled delivery trip");
        }
        if ("DELIVERED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Delivery trip has already been completed");
        }

        if(!"SCHEDULED".equals(delivery.getStatus()) && !"RESCHEDULED".equals(delivery.getStatus())) throw new BusinessException("Only scheduled or rescheduled trips can be dispatched");
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

        if (delivery.getVehicle() != null && !delivery.getVehicle().isDeleted()) {
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
        delivery.getInvoices().forEach(inv -> com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer()));

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

        if (delivery.getVehicle() != null && !delivery.getVehicle().isDeleted()) {
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
    public DeliveryDto rescheduleDelivery(Long id, RescheduleDeliveryRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));
        delivery.getInvoices().forEach(inv -> com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer()));

        if ("CANCELLED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot reschedule a cancelled delivery trip");
        }
        if ("DELIVERED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot reschedule an already completed delivery trip");
        }
        if ("IN_TRANSIT".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot reschedule a trip that is already in transit");
        }

        if (req == null || req.getNewScheduledDate() == null) {
            throw new BusinessException("New scheduled date is required");
        }
        if (req.getReason() == null || req.getReason().trim().isEmpty()) {
            throw new BusinessException("Reason for rescheduling is required");
        }

        delivery.setStatus("RESCHEDULED");
        delivery.setRescheduleReason(req.getReason().trim());
        delivery.setRescheduledDate(req.getNewScheduledDate());
        delivery.setRescheduledAt(LocalDateTime.now());
        delivery.setScheduledDate(req.getNewScheduledDate());

        if (req.getNotes() != null && !req.getNotes().trim().isEmpty()) {
            delivery.setNotes(req.getNotes().trim());
        }

        if (delivery.getVehicle() != null && !delivery.getVehicle().isDeleted()) {
            delivery.getVehicle().setStatus("AVAILABLE");
            vehicleRepository.save(delivery.getVehicle());
        }

        Delivery saved = deliveryRepository.save(delivery);

        auditLogService.log(
                "DELIVERY_RESCHEDULE",
                "Delivery",
                saved.getDeliveryNumber(),
                String.format("Delivery trip '%s' rescheduled to %s. Reason: %s",
                        saved.getDeliveryNumber(), req.getNewScheduledDate(), req.getReason().trim())
        );

        return DeliveryDto.from(saved, true);
    }

    @Transactional
    public DeliveryDto cancelDelivery(Long id, UpdateDeliveryStatusRequest req) {
        Delivery delivery = deliveryRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", "id", id));
        delivery.getInvoices().forEach(inv -> com.nbh.erp.customer.repository.CustomerRepository.requireActive(inv.getCustomer()));

        if ("DELIVERED".equalsIgnoreCase(delivery.getStatus())) {
            throw new BusinessException("Cannot cancel an already completed delivery trip");
        }

        if("CANCELLED".equals(delivery.getStatus())) throw new BusinessException("Trip already cancelled");
        delivery.setStatus("CANCELLED");
        delivery.setCancellationDate(LocalDateTime.now());
        delivery.setCancellationReason(req != null && req.getCancellationReason() != null
                ? req.getCancellationReason()
                : "Cancelled by distribution controller");

        if (delivery.getVehicle() != null && !delivery.getVehicle().isDeleted()) {
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
        long rescheduled = deliveryRepository.countByStatus("RESCHEDULED");
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
                .rescheduledCount(rescheduled)
                .todayDeliveriesCount(today)
                .pendingInvoicesForDeliveryCount(pendingInvoices)
                .totalDeliveredAmount(deliveredAmount)
                .build();
    }
}
