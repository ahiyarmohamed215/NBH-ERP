package com.nbh.erp.realtime;

import com.nbh.erp.security.UserPrincipal;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

class RealtimePolicyTest {
    UserPrincipal as(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var user = UserPrincipal.builder().id(1L).username("cashier-a").active(true).authorities(authorities).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,authorities));
        return user;
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    @Test void ordersReuseControllerPermissionRatherThanSupplierReferenceAccess() {
        var event = new RealtimeChanges.Change("orders",null);
        assertFalse(RealtimeStreams.allowed(event,as("GRN_PROCESS")));
        assertFalse(RealtimeStreams.allowed(event,as("SUPPLIER_VIEW")));
        assertTrue(RealtimeStreams.allowed(event,as("SUPPLIER_MANAGE")));
        assertFalse(RealtimeStreams.allowed(event,as()));
    }
    @Test void salesRespectCashierOwnershipAndCurrentPermissions() {
        var event = new RealtimeChanges.Change("sales","cashier-b");
        assertFalse(RealtimeStreams.allowed(event,as("SALES_CREATE")));
        assertTrue(RealtimeStreams.allowed(new RealtimeChanges.Change("sales","cashier-a"),as("SALES_CREATE")));
        assertTrue(RealtimeStreams.allowed(event,as("SALES_VIEW_ALL")));
        assertFalse(RealtimeStreams.allowed(new RealtimeChanges.Change("sales","cashier-a"),as()));
    }
}
