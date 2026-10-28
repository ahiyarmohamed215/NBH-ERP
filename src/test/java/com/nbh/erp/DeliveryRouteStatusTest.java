package com.nbh.erp;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.delivery.dto.CreateDeliveryRouteRequest;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.delivery.service.DeliveryRouteService;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DeliveryRouteStatusTest {
    @Test
    void routeStatusPersistsAndOmittedStatusPreservesExistingValue() {
        var routes = mock(DeliveryRouteRepository.class);
        var customers = mock(CustomerRepository.class);
        var service = new DeliveryRouteService(routes, customers, mock(UserRepository.class), mock(AuditLogService.class));
        var route = DeliveryRoute.builder().id(10L).routeCode("DR-010").routeName("Western route").isActive(true).build();
        when(routes.findById(10L)).thenReturn(Optional.of(route));
        when(routes.save(any(DeliveryRoute.class))).thenAnswer(call -> call.getArgument(0));
        when(customers.findByDeliveryRouteId(10L)).thenReturn(List.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin", "", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        try {
            var request = CreateDeliveryRouteRequest.builder().routeName("Western route").isActive(false).build();
            assertFalse(service.updateRoute(10L, request).getIsActive());
            request.setIsActive(null);
            assertFalse(service.updateRoute(10L, request).getIsActive());
            request.setIsActive(true);
            assertTrue(service.updateRoute(10L, request).getIsActive());
            assertNull(route.getAssignedStaff());
            route.setArea("Colombo");
            assertFalse(service.toggleActive(10L).getIsActive());
            assertEquals("Colombo", route.getArea());
            assertTrue(service.toggleActive(10L).getIsActive());
            verify(customers, never()).requireActiveCustomers(any());

            var draft = CreateDeliveryRouteRequest.builder().routeName("New route").isActive(false).build();
            assertFalse(service.createRoute(draft).getIsActive());
            draft.setIsActive(null);
            assertTrue(service.createRoute(draft).getIsActive());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
