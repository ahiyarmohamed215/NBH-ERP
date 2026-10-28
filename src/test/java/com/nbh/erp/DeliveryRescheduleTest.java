package com.nbh.erp;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.service.IdempotencyService;
import com.nbh.erp.delivery.dto.RescheduleDeliveryRequest;
import com.nbh.erp.delivery.dto.UpdateDeliveryStatusRequest;
import com.nbh.erp.delivery.entity.Delivery;
import com.nbh.erp.delivery.entity.Vehicle;
import com.nbh.erp.delivery.repository.DeliveryRepository;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.delivery.service.DeliveryService;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DeliveryRescheduleTest {

    @Test
    void testRescheduleDeliveryFlow() {
        var deliveries = mock(DeliveryRepository.class);
        var routes = mock(DeliveryRouteRepository.class);
        var vehicles = mock(VehicleRepository.class);
        var warehouses = mock(WarehouseRepository.class);
        var invoices = mock(InvoiceRepository.class);
        var users = mock(UserRepository.class);
        var audit = mock(AuditLogService.class);
        var seq = mock(DocumentSequenceService.class);
        var idempotency = mock(IdempotencyService.class);

        var vehicle = Vehicle.builder().id(10L).vehicleNumber("WP-CA-1234").status("ON_DELIVERY").build();
        var delivery = Delivery.builder()
                .id(1L)
                .deliveryNumber("DEL-20261026-001")
                .status("SCHEDULED")
                .scheduledDate(LocalDate.of(2026, 10, 26))
                .vehicle(vehicle)
                .invoices(new ArrayList<>())
                .build();

        when(deliveries.findByIdForUpdate(1L)).thenReturn(Optional.of(delivery));
        when(deliveries.save(any(Delivery.class))).thenAnswer(call -> call.getArgument(0));

        var service = new DeliveryService(idempotency, deliveries, routes, vehicles, users, warehouses, invoices, audit, seq);

        // 1. Reschedule without date or reason fails
        assertThrows(BusinessException.class, () -> service.rescheduleDelivery(1L, RescheduleDeliveryRequest.builder().build()));
        assertThrows(BusinessException.class, () -> service.rescheduleDelivery(1L, RescheduleDeliveryRequest.builder()
                .newScheduledDate(LocalDate.of(2026, 10, 27))
                .reason("   ")
                .build()));

        // 2. Successful reschedule
        var rescheduleReq = RescheduleDeliveryRequest.builder()
                .newScheduledDate(LocalDate.of(2026, 10, 27))
                .reason("Driver was unwell, trip postponed")
                .notes("Contacted assistant to confirm")
                .build();

        var result = service.rescheduleDelivery(1L, rescheduleReq);

        assertEquals("RESCHEDULED", result.getStatus());
        assertEquals(LocalDate.of(2026, 10, 27), result.getScheduledDate());
        assertEquals(LocalDate.of(2026, 10, 27), result.getRescheduledDate());
        assertEquals("Driver was unwell, trip postponed", result.getRescheduleReason());
        assertEquals("AVAILABLE", vehicle.getStatus());

        // 3. Rescheduled trip can be dispatched when it goes
        var dispatchReq = UpdateDeliveryStatusRequest.builder()
                .departureTime(LocalDateTime.of(2026, 10, 27, 8, 30))
                .notes("Departed safely on route")
                .build();

        var dispatched = service.dispatchDelivery(1L, dispatchReq);
        assertEquals("IN_TRANSIT", dispatched.getStatus());
        assertEquals("ON_DELIVERY", vehicle.getStatus());
        assertEquals("Departed safely on route", dispatched.getNotes());
    }

    @Test
    void testCannotRescheduleCompletedOrCancelledTrips() {
        var deliveries = mock(DeliveryRepository.class);
        var service = new DeliveryService(mock(IdempotencyService.class), deliveries, mock(DeliveryRouteRepository.class),
                mock(VehicleRepository.class), mock(UserRepository.class), mock(WarehouseRepository.class),
                mock(InvoiceRepository.class), mock(AuditLogService.class), mock(DocumentSequenceService.class));

        var completedDelivery = Delivery.builder().id(2L).status("DELIVERED").invoices(new ArrayList<>()).build();
        when(deliveries.findByIdForUpdate(2L)).thenReturn(Optional.of(completedDelivery));

        var req = RescheduleDeliveryRequest.builder()
                .newScheduledDate(LocalDate.of(2026, 10, 28))
                .reason("Postpone")
                .build();

        assertThrows(BusinessException.class, () -> service.rescheduleDelivery(2L, req));

        var inTransitDelivery = Delivery.builder().id(3L).status("IN_TRANSIT").invoices(new ArrayList<>()).build();
        when(deliveries.findByIdForUpdate(3L)).thenReturn(Optional.of(inTransitDelivery));
        assertThrows(BusinessException.class, () -> service.rescheduleDelivery(3L, req));
    }
}
