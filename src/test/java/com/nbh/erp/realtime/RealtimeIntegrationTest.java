package com.nbh.erp.realtime;

import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.net.URI;
import java.net.http.*;
import java.io.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeIntegrationTest {
    @LocalServerPort int port;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired PlatformTransactionManager transactions;
    @Autowired RealtimeChanges changes;
    URI endpoint() { return URI.create("http://localhost:"+port+"/api/v1/events"); }

    @Test void rejectsUnauthenticatedStreamsAndQueryStringTokens() throws Exception {
        var client = HttpClient.newHttpClient();
        for (String suffix : List.of("", "?token=untrusted")) {
            var response = client.send(HttpRequest.newBuilder(URI.create(endpoint()+suffix)).timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(401,response.statusCode());
        }
    }

    @Test void actualSseStreamUsesBearerAuthAndJpaChangesEmitOnlyTopicsAfterCommit() throws Exception {
        var tx = new TransactionTemplate(transactions);
        String key = UUID.randomUUID().toString().replace("-", "");
        var principal = tx.execute(status -> {
            var role = roles.save(Role.builder().name("ROLE_RT_"+key).permissions(new HashSet<>(List.of(permissions.findByName("SUPPLIER_MANAGE").orElseThrow()))).build());
            return UserPrincipal.create(users.save(User.builder().username("realtime-"+key).email(key+"@example.test")
                    .fullName("Realtime test").password("unused").isActive(true).approvalStatus("APPROVED").roles(new HashSet<>(List.of(role))).build()));
        });
        String token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));
        var client = HttpClient.newHttpClient();
        var response = client.send(HttpRequest.newBuilder(endpoint()).header("Authorization","Bearer "+token).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
        assertEquals(200,response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").contains("text/event-stream"));
        assertEquals("no-store, no-transform",response.headers().firstValue("Cache-Control").orElse(""));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor(); var body = response.body()) {
            var reader = new BufferedReader(new InputStreamReader(body));
            assertEquals("event:ready",executor.submit(reader::readLine).get(10,TimeUnit.SECONDS));
            tx.executeWithoutResult(status -> {
                changes.changed("orders",null);
                roles.saveAndFlush(Role.builder().name("ROLE_RT_SECOND_"+key).permissions(new HashSet<>()).build());
            });
            String frame = executor.submit(() -> {
                StringBuilder result = new StringBuilder(); String line;
                while ((line=reader.readLine())!=null) {
                    result.append(line).append('\n');
                    if (line.startsWith("data:") && line.contains("topics")) break;
                }
                return result.toString();
            }).get(15,TimeUnit.SECONDS);
            assertTrue(frame.contains("event:invalidate"));
            assertTrue(frame.contains("orders")); assertTrue(frame.contains("roles"));
            assertFalse(frame.contains(key)); assertFalse(frame.contains("owner"));

            tx.executeWithoutResult(status -> {
                var user = users.findById(principal.getId()).orElseThrow();
                var role = user.getRoles().iterator().next();
                role.getPermissions().clear();
                roles.saveAndFlush(role);
                changes.changed("roles",null);
                changes.changed("orders",null);
            });
            String revoked = executor.submit(() -> {
                String line;
                while ((line=reader.readLine())!=null) if (line.startsWith("data:") && line.contains("topics")) return line;
                return "";
            }).get(15,TimeUnit.SECONDS);
            assertTrue(revoked.contains("roles"));
            assertFalse(revoked.contains("orders"), "Existing connections must use current database permissions");

            tx.executeWithoutResult(status -> {
                var user = users.findById(principal.getId()).orElseThrow();
                user.setTokenVersion(user.getTokenVersion()+1);
                users.saveAndFlush(user);
            });
            assertNull(executor.submit(() -> {
                String line;
                while ((line=reader.readLine())!=null) { /* Drain trailing heartbeats until the revoked stream closes. */ }
                return line;
            }).get(15,TimeUnit.SECONDS));
        }
    }
}
