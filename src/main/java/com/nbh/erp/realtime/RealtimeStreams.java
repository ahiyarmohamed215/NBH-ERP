package com.nbh.erp.realtime;

import com.nbh.erp.security.CustomUserDetailsService;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.security.UserPrincipal;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class RealtimeStreams {
    private final CustomUserDetailsService users;
    private final Set<Client> clients = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().name("erp-sse-clock-", 0).daemon(true).factory());
    private final ThreadPoolExecutor writers = new ThreadPoolExecutor(4, 4, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(256), Thread.ofPlatform().name("erp-sse-writer-", 0).daemon(true).factory(),
            new ThreadPoolExecutor.AbortPolicy());
    public RealtimeStreams(CustomUserDetailsService users) { this.users = users; }

    private static final class Client {
        final UserPrincipal principal;
        final long expires;
        final SseEmitter emitter;
        final Set<RealtimeChanges.Change> pending = ConcurrentHashMap.newKeySet();
        final AtomicBoolean writing = new AtomicBoolean();
        volatile long lastHeartbeat;
        Client(UserPrincipal principal, long expires) {
            this.principal = principal; this.expires = expires;
            emitter = new SseEmitter(Math.max(1, Math.min(300_000, expires - System.currentTimeMillis())));
        }
    }

    @PostConstruct void start() { clock.scheduleWithFixedDelay(this::tick, 1, 1, TimeUnit.SECONDS); }

    public synchronized SseEmitter connect(UserPrincipal principal, long expires) {
        if (clients.size() >= 256 || clients.stream().filter(c -> c.principal.getId().equals(principal.getId())).count() >= 6)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Realtime connection limit reached");
        Client client = new Client(principal, expires);
        client.emitter.onCompletion(() -> clients.remove(client));
        client.emitter.onTimeout(() -> close(client));
        client.emitter.onError(error -> close(client));
        clients.add(client);
        try { client.emitter.send(SseEmitter.event().name("ready").data("{}")); }
        catch (Exception error) { close(client); }
        return client.emitter;
    }

    // Called only after commit. No socket writes, authorization queries, or unbounded event history here.
    public void enqueue(Set<RealtimeChanges.Change> changes) {
        for (Client client : clients) {
            client.pending.addAll(changes);
            if (client.pending.size() > 256) close(client); // Slow consumers reconnect and reconcile.
        }
    }

    void tick() {
        for (Client client : clients) {
            if (client.expires <= System.currentTimeMillis()) { close(client); continue; }
            if (client.pending.isEmpty() && System.currentTimeMillis() - client.lastHeartbeat < 15_000) continue;
            if (!client.writing.compareAndSet(false, true)) continue;
            try { writers.execute(() -> drain(client)); }
            catch (RejectedExecutionException error) { client.writing.set(false); close(client); }
        }
    }

    private void drain(Client client) {
        var previous = SecurityContextHolder.getContext();
        try {
            UserPrincipal current = (UserPrincipal) users.loadUserByUsername(client.principal.getUsername());
            if (!current.isEnabled() || !current.getId().equals(client.principal.getId())
                    || current.getTokenVersion() != client.principal.getTokenVersion()
                    || client.expires <= System.currentTimeMillis() || !clients.contains(client)) { close(client); return; }
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(new UsernamePasswordAuthenticationToken(current, null, current.getAuthorities()));
            SecurityContextHolder.setContext(context);
            Set<String> topics = new TreeSet<>();
            String primaryType = null;
            Long targetProductId = null;
            Long targetWarehouseId = null;
            Long targetInvoiceId = null;
            Long targetGrnId = null;
            List<Map<String, Object>> details = new ArrayList<>();

            for (var change : Set.copyOf(client.pending)) {
                client.pending.remove(change);
                if (allowed(change, current)) {
                    topics.add(change.topic());
                    if (change.type() != null) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("topic", change.topic());
                        item.put("type", change.type());
                        if (change.productId() != null) item.put("productId", change.productId());
                        if (change.warehouseId() != null) item.put("warehouseId", change.warehouseId());
                        if (change.invoiceId() != null) item.put("invoiceId", change.invoiceId());
                        if (change.grnId() != null) item.put("grnId", change.grnId());
                        details.add(item);

                        if (primaryType == null) primaryType = change.type();
                        if (targetProductId == null && change.productId() != null) targetProductId = change.productId();
                        if (targetWarehouseId == null && change.warehouseId() != null) targetWarehouseId = change.warehouseId();
                        if (targetInvoiceId == null && change.invoiceId() != null) targetInvoiceId = change.invoiceId();
                        if (targetGrnId == null && change.grnId() != null) targetGrnId = change.grnId();
                    }
                }
            }

            if (!topics.isEmpty()) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("topics", topics);
                if (primaryType != null) payload.put("type", primaryType);
                if (targetProductId != null) payload.put("productId", targetProductId);
                if (targetWarehouseId != null) payload.put("warehouseId", targetWarehouseId);
                if (targetInvoiceId != null) payload.put("invoiceId", targetInvoiceId);
                if (targetGrnId != null) payload.put("grnId", targetGrnId);
                if (!details.isEmpty()) payload.put("details", details);
                payload.put("timestamp", System.currentTimeMillis());

                client.emitter.send(SseEmitter.event().name("invalidate").data(payload));
            }
            client.emitter.send(SseEmitter.event().comment("heartbeat"));
            client.lastHeartbeat = System.currentTimeMillis();
        } catch (Exception error) { close(client); }
        finally { SecurityContextHolder.setContext(previous); client.writing.set(false); }
    }

    static boolean allowed(RealtimeChanges.Change change, UserPrincipal user) {
        return switch (change.topic()) {
            case "orders" -> SecurityUtils.isAdministrator() || SecurityUtils.hasAuthority("SUPPLIER_MANAGE");
            case "sales" -> SecurityUtils.canRead("SALES") && (SecurityUtils.isAdministrator()
                    || SecurityUtils.hasAuthority("SALES_VIEW_ALL") || Objects.equals(change.owner(), user.getUsername()));
            case "suppliers" -> SecurityUtils.canRead("SUPPLIER");
            case "grn" -> SecurityUtils.canRead("GRN");
            case "gtn" -> SecurityUtils.canRead("GTN");
            case "prn" -> SecurityUtils.canRead("PRN");
            case "inventory" -> SecurityUtils.canRead("INVENTORY") || SecurityUtils.canRead("PRODUCT")
                    || SecurityUtils.canRead("BRAND") || SecurityUtils.canRead("CATEGORY") || SecurityUtils.canRead("WAREHOUSE");
            case "customers" -> SecurityUtils.canRead("CUSTOMER");
            case "targets" -> SecurityUtils.canRead("CUSTOMER_TARGET");
            case "payments" -> SecurityUtils.canRead("PAYMENT");
            case "returns" -> SecurityUtils.canRead("SALES") || SecurityUtils.canRead("PAYMENT");
            case "quotations" -> SecurityUtils.canRead("QUOTATION");
            case "delivery" -> SecurityUtils.canRead("DELIVERY");
            case "dashboard" -> SecurityUtils.canRead("DASHBOARD");
            case "reports" -> SecurityUtils.canRead("REPORT");
            case "audit" -> SecurityUtils.canRead("AUDIT");
            // All signed-in users must reconcile their own profile after access changes. No user/role data is sent.
            case "users", "roles" -> true;
            default -> false;
        };
    }

    private void close(Client client) {
        if (clients.remove(client)) {
            try { client.emitter.complete(); }
            catch (IllegalStateException ignored) { /* Container already completed the async request. */ }
        }
    }
    @PreDestroy void stop() { clock.shutdownNow(); clients.forEach(this::close); writers.shutdownNow(); }
}
