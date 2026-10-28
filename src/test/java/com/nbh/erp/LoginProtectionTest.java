package com.nbh.erp;

import com.nbh.erp.auth.service.LoginProtection;
import com.nbh.erp.security.LoginThrottleFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class LoginProtectionTest {
    static class Time extends Clock {
        long millis;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(millis); }
        void advance(long seconds) { millis += seconds * 1000; }
    }
    @Test void officeIpAllowsManyEmployeesButHasABoundedBurstAndRefills() {
        var clock = new Time(); var protection = new LoginProtection(clock);
        for (int i=0;i<120;i++) {
            assertTrue(protection.allowIp("office"));
            assertTrue(protection.beginAccount("employee:"+i));
        }
        assertFalse(protection.allowIp("office"));
        assertTrue(protection.allowIp("other"));
        clock.advance(1); assertTrue(protection.allowIp("office"));
    }
    @Test void cooldownIsBoundedAndDeniedRequestsDoNotExtendIt() {
        var clock = new Time(); var p = new LoginProtection(clock);
        for(int i=0;i<5;i++) assertTrue(p.beginAccount("account"));
        for(int i=0;i<29;i++) { clock.advance(1); assertFalse(p.beginAccount("account")); }
        clock.advance(1); assertTrue(p.beginAccount("account"));
        for(int i=0;i<4;i++) assertTrue(p.beginAccount("account"));
        assertFalse(p.beginAccount("account"));
        clock.advance(59); assertFalse(p.beginAccount("account"));
        clock.advance(1); assertTrue(p.beginAccount("account"));
        for(int round=0;round<8;round++) {
            for(int i=0;i<4;i++) assertTrue(p.beginAccount("account"));
            assertFalse(p.beginAccount("account"));
            clock.advance(300); assertTrue(p.beginAccount("account"));
        }
    }
    @Test void successResetsOnlyItsOwnAccountAndIdleStateExpires() {
        var clock=new Time(); var p=new LoginProtection(clock);
        for(int i=0;i<5;i++) { assertTrue(p.beginAccount("a")); assertTrue(p.beginAccount("b")); }
        p.success("a"); assertTrue(p.beginAccount("a")); assertFalse(p.beginAccount("b"));
        clock.advance(901); assertTrue(p.beginAccount("b"));
    }
    @Test void parallelAttemptsCannotRacePastThreshold() throws Exception {
        var p=new LoginProtection(); var allowed=new AtomicInteger();
        try(var pool=Executors.newFixedThreadPool(12)) {
            var tasks=new java.util.ArrayList<Future<?>>();
            for(int i=0;i<60;i++) tasks.add(pool.submit(()->{ if(p.beginAccount("a")) allowed.incrementAndGet(); }));
            for(var task:tasks) task.get();
        }
        assertEquals(5,allowed.get());
    }
    @Test void cacheSaturationFailsClosedWithoutEvictingActiveLimits() {
        var clock=new Time(); var p=new LoginProtection(clock);
        for(int i=0;i<20_000;i++) assertTrue(p.beginAccount("a"+i));
        assertFalse(p.beginAccount("overflow"));
        clock.advance(901); assertTrue(p.beginAccount("overflow"));
    }
    @Test void ipFilterIgnoresForgedForwardingHeadersAndDoesNotParseBodies() throws Exception {
        var filter=new LoginThrottleFilter(new LoginProtection()); var passed=new AtomicInteger();
        for(int i=0;i<122;i++) {
            var req=new MockHttpServletRequest("POST","/api/v1/auth/login");
            req.setServletPath("/api/v1/auth/login"); req.setRemoteAddr("192.0.2.1");
            req.addHeader("X-Forwarded-For","198.51.100."+i); req.setContent("invalid-json".getBytes());
            var res=new MockHttpServletResponse();
            filter.doFilter(req,res,(r,s)->passed.incrementAndGet());
            if(i>=120) { assertEquals(429,res.getStatus()); assertEquals("60",res.getHeader("Retry-After")); }
        }
        assertEquals(120,passed.get());
        var refresh=new MockHttpServletRequest("POST","/api/v1/auth/refresh");
        refresh.setServletPath("/api/v1/auth/refresh"); refresh.setRemoteAddr("192.0.2.1");
        filter.doFilter(refresh,new MockHttpServletResponse(),(r,s)->passed.incrementAndGet());
        assertEquals(121,passed.get());
    }
    @Test void auditRequestIdsCannotContainLogInjectionOrUnboundedInput() throws Exception {
        var filter=new com.nbh.erp.config.RequestIdFilter();
        for(String supplied:java.util.List.of("safe-request_123", "forged\nentry", "a".repeat(1000))) {
            var req=new MockHttpServletRequest();req.addHeader("X-Request-Id",supplied);
            var res=new MockHttpServletResponse();
            filter.doFilter(req,res,(r,s)->{
                assertTrue(com.nbh.erp.config.RequestIdFilter.getCurrentRequestId().matches("[A-Za-z0-9._-]{1,64}"));
            });
            if(supplied.startsWith("safe")) assertEquals(supplied,res.getHeader("X-Request-Id"));
            else assertNotEquals(supplied,res.getHeader("X-Request-Id"));
        }
    }
}
