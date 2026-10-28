package com.nbh.erp;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.service.IdempotencyService;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.delivery.dto.CreateDeliveryRequest;
import com.nbh.erp.delivery.dto.CreateDeliveryRouteRequest;
import com.nbh.erp.delivery.entity.Delivery;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.repository.DeliveryRepository;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.delivery.service.DeliveryRouteService;
import com.nbh.erp.delivery.service.DeliveryService;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DeliveryDraftTest {

    @Test
    void routeCanBeSavedAsDraftWithSingleField() {
        var routes = mock(DeliveryRouteRepository.class);
        var customers = mock(CustomerRepository.class);
        var service = new DeliveryRouteService(routes, customers, mock(UserRepository.class), mock(AuditLogService.class));
        when(routes.save(any(DeliveryRoute.class))).thenAnswer(call -> {
            DeliveryRoute r = call.getArgument(0);
            r.setId(99L);
            return r;
        });

        // 1. Empty draft fails validation
        var empty = CreateDeliveryRouteRequest.builder().isDraft(true).build();
        assertThrows(BusinessException.class, () -> service.createRoute(empty));

        // 2. Draft with only area filled succeeds
        var areaOnly = CreateDeliveryRouteRequest.builder().area("Southern Province").isDraft(true).build();
        var draftDto = service.createRoute(areaOnly);
        assertEquals("DRAFT", draftDto.getStatus());
        assertFalse(draftDto.getIsActive());
        assertEquals("Southern Province", draftDto.getArea());
        assertNotNull(draftDto.getRouteName());
        assertTrue(draftDto.getRouteName().startsWith("Draft Route"));
    }

    @Test
    void deliveryTripCanBeSavedAsDraftWithSingleField() {
        var deliveries = mock(DeliveryRepository.class);
        var routes = mock(DeliveryRouteRepository.class);
        var vehicles = mock(VehicleRepository.class);
        var warehouses = mock(WarehouseRepository.class);
        var invoices = mock(InvoiceRepository.class);
        var users = mock(UserRepository.class);
        var audit = mock(AuditLogService.class);
        var seq = mock(DocumentSequenceService.class);
        var idempotency = mock(IdempotencyService.class);

        when(seq.getNextNumber("DEL")).thenReturn("DEL-20261026-001");
        when(warehouses.findById(5L)).thenReturn(Optional.of(Warehouse.builder().id(5L).name("Central Hub").build()));
        when(deliveries.save(any(Delivery.class))).thenAnswer(call -> {
            Delivery d = call.getArgument(0);
            d.setId(50L);
            return d;
        });
        when(idempotency.complete(any(), any(), any())).thenAnswer(call -> call.getArgument(2));

        var service = new DeliveryService(idempotency, deliveries, routes, vehicles, users, warehouses, invoices, audit, seq);

        // 1. Empty draft fails
        var emptyReq = CreateDeliveryRequest.builder().isDraft(true).build();
        assertThrows(BusinessException.class, () -> service.createDelivery(emptyReq));

        // 2. Single field draft (warehouse only) succeeds
        var singleFieldReq = CreateDeliveryRequest.builder().warehouseId(5L).isDraft(true).build();
        var created = service.createDelivery(singleFieldReq);
        assertEquals("DRAFT", created.getStatus());
        assertEquals("DEL-20261026-001", created.getDeliveryNumber());
        assertEquals(5L, created.getWarehouseId());
        assertNull(created.getDriverId());
        assertNull(created.getAssistantStaffId());
        assertNull(created.getScheduledDate());

        // 3. Normal non-draft requires driver, assistant, scheduled date, and invoices
        var incompleteReq = CreateDeliveryRequest.builder().warehouseId(5L).isDraft(false).build();
        assertThrows(BusinessException.class, () -> service.createDelivery(incompleteReq));

        // 4. Special invoices are saved and parsed in DeliveryDto
        var specialDraftReq = CreateDeliveryRequest.builder()
                .warehouseId(5L)
                .isDraft(true)
                .specialInvoiceIds(java.util.List.of(101L, 202L))
                .build();
        var withSpecial = service.createDelivery(specialDraftReq);
        assertNotNull(withSpecial);
        assertEquals(java.util.List.of(101L, 202L), withSpecial.getSpecialInvoiceIds());
    }
}
