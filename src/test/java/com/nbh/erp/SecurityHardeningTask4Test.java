package com.nbh.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.category.dto.CreateCategoryRequest;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class SecurityHardeningTask4Test {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private Statistics stats;

    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);
    }

    private String createTestUserAndGetToken(String username, Set<Role> roles, boolean active, long tokenVersion) {
        userRepository.findByUsername(username).ifPresent(userRepository::delete);

        User user = User.builder()
                .username(username)
                .email(username + "@example.com")
                .fullName("Task 4 Verification Staff")
                .phone("0771234567")
                .password(passwordEncoder.encode(TEST_PASSWORD))
                .isActive(active)
                .approvalStatus("APPROVED")
                .tokenVersion(tokenVersion)
                .roles(roles != null ? new HashSet<>(roles) : new HashSet<>())
                .build();
        userRepository.save(user);

        UserPrincipal principal = UserPrincipal.create(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        return tokenProvider.generateAccessToken(auth);
    }

    @Test
    @DisplayName("1. Immediate Account Deactivation Revocation (No Stale Window)")
    void testImmediateAccountDeactivation() throws Exception {
        String token = createTestUserAndGetToken("task4_deact_user", Set.of(), true, 0L);

        // 1. Initial request succeeds
        mvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        // 2. Deactivate user in database
        User user = userRepository.findByUsername("task4_deact_user").orElseThrow();
        user.setIsActive(false);
        userRepository.save(user);

        // 3. Next request MUST be immediately denied (401 Unauthorized) without cache delay or server restart
        mvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. Immediate TokenVersion Revocation (Global Session Invalidation)")
    void testImmediateTokenVersionRevocation() throws Exception {
        String token = createTestUserAndGetToken("task4_ver_user", Set.of(), true, 0L);

        // 1. Initial request succeeds
        mvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        // 2. Increment tokenVersion in database (e.g. password reset or admin force logout)
        User user = userRepository.findByUsername("task4_ver_user").orElseThrow();
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        // 3. Next request with old token MUST be immediately rejected (401 Unauthorized)
        mvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("3. Immediate Role Revocation (Role-Restricted Endpoint)")
    void testImmediateRoleRevocation() throws Exception {
        Permission managePerm = permissionRepository.findByName("CATEGORY_MANAGE")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("CATEGORY_MANAGE").module("CATEGORY").build()));

        Role categoryAdminRole = roleRepository.findByName("ROLE_TASK4_CAT_MGR")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_TASK4_CAT_MGR")
                        .description("Task 4 Category Manager")
                        .permissions(new HashSet<>(Set.of(managePerm)))
                        .build()));

        String token = createTestUserAndGetToken("task4_role_user", Set.of(categoryAdminRole), true, 0L);

        // 1. Authorized endpoint works
        CreateCategoryRequest req = new CreateCategoryRequest("T4C1", "Cat One", "Desc", "ACTIVE");
        mvc.perform(post("/api/v1/categories")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        // 2. Revoke role in database
        User user = userRepository.findByUsername("task4_role_user").orElseThrow();
        user.setRoles(new HashSet<>());
        userRepository.save(user);

        // 3. Next request to protected endpoint MUST immediately return 403 Forbidden
        CreateCategoryRequest req2 = new CreateCategoryRequest("T4C2", "Cat Two", "Desc", "ACTIVE");
        mvc.perform(post("/api/v1/categories")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("4. Immediate Permission Revocation (Permission Modification on Role)")
    void testImmediatePermissionRevocation() throws Exception {
        Permission perm = permissionRepository.findByName("CATEGORY_MANAGE")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("CATEGORY_MANAGE").module("CATEGORY").build()));

        Role role = roleRepository.findByName("ROLE_TASK4_PERM_MGR")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_TASK4_PERM_MGR")
                        .description("Role for Permission Revocation")
                        .permissions(new HashSet<>(Set.of(perm)))
                        .build()));

        // Ensure permission is attached
        role.setPermissions(new HashSet<>(Set.of(perm)));
        roleRepository.save(role);

        String token = createTestUserAndGetToken("task4_perm_user", Set.of(role), true, 0L);

        // 1. Authorized request succeeds
        CreateCategoryRequest req = new CreateCategoryRequest("T4P1", "Cat Perm One", "Desc", "ACTIVE");
        mvc.perform(post("/api/v1/categories")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        // 2. Remove permission from role
        role.setPermissions(new HashSet<>());
        roleRepository.save(role);

        // 3. Next request MUST immediately fail with 403 Forbidden
        CreateCategoryRequest req2 = new CreateCategoryRequest("T4P2", "Cat Perm Two", "Desc", "ACTIVE");
        mvc.perform(post("/api/v1/categories")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("5. Concurrency & HikariCP Pool Health (Single, 6 Concurrent, 20 Concurrent)")
    void testConcurrencyAndConnectionPoolHealth() throws Exception {
        String token = createTestUserAndGetToken("task4_concurrency_user", Set.of(), true, 0L);

        // Warm up
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token));

        // Baseline: Single Request
        long singleStart = System.nanoTime();
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
        long singleLatencyMs = (System.nanoTime() - singleStart) / 1_000_000;

        // 6 Concurrent Requests (Simulating multi-tab/user actions)
        long p95_6 = runConcurrentRequests(6, token);

        // 20 Concurrent Requests (Simulating office team load at max Hikari pool size)
        long p95_20 = runConcurrentRequests(20, token);

        System.out.println("=================================================");
        System.out.println(">>> TASK 4 CONCURRENCY & HIKARICP POOL HEALTH <<<");
        System.out.printf("Single Request Latency:          %d ms%n", singleLatencyMs);
        System.out.printf("6 Concurrent Requests p95:       %d ms%n", p95_6);
        System.out.printf("20 Concurrent Requests p95:      %d ms%n", p95_20);
        System.out.println("=================================================");

        assertTrue(p95_6 < 1000, "6 concurrent requests p95 should be well under 1000ms");
        assertTrue(p95_20 < 2000, "20 concurrent requests p95 should be well under 2000ms");
    }

    private long runConcurrentRequests(int concurrency, String token) throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(concurrency);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(concurrency);
        List<Long> latencies = new CopyOnWriteArrayList<>();
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < concurrency; i++) {
            executor.submit(() -> {
                try {
                    startGate.await();
                    long start = System.nanoTime();
                    MvcResult res = mvc.perform(get("/api/v1/auth/me")
                                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                            .andReturn();
                    long dur = (System.nanoTime() - start) / 1_000_000;
                    latencies.add(dur);
                    if (res.getResponse().getStatus() == 200) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    endGate.countDown();
                }
            });
        }

        startGate.countDown();
        boolean completed = endGate.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "All concurrent requests must complete within 10 seconds");
        assertEquals(concurrency, successCount.get(), "All concurrent requests must succeed with HTTP 200");

        Collections.sort(latencies);
        int p95Index = (int) Math.ceil(0.95 * latencies.size()) - 1;
        if (p95Index < 0) p95Index = 0;
        return latencies.get(p95Index);
    }
}
