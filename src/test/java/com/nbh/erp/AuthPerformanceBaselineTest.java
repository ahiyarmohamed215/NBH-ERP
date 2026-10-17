package com.nbh.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.auth.dto.LoginRequest;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.security.CustomUserDetailsService;
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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class AuthPerformanceBaselineTest {

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
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private Statistics stats;

    private static final String TEST_USERNAME = "perf_baseline_staff";
    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);

        // Ensure 2 roles with 2 permissions each for realistic measurement
        Permission p1 = permissionRepository.findByName("PRODUCT_READ")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("PRODUCT_READ").module("INVENTORY").build()));
        Permission p2 = permissionRepository.findByName("PRODUCT_WRITE")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("PRODUCT_WRITE").module("INVENTORY").build()));
        Permission p3 = permissionRepository.findByName("INVOICE_READ")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("INVOICE_READ").module("SALES").build()));
        Permission p4 = permissionRepository.findByName("INVOICE_WRITE")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("INVOICE_WRITE").module("SALES").build()));

        Role roleSales = roleRepository.findByName("ROLE_SALES")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_SALES")
                        .description("Sales Role")
                        .permissions(new HashSet<>(Set.of(p3, p4)))
                        .build()));

        Role roleInventory = roleRepository.findByName("ROLE_INVENTORY")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_INVENTORY")
                        .description("Inventory Role")
                        .permissions(new HashSet<>(Set.of(p1, p2)))
                        .build()));

        userRepository.findByUsername(TEST_USERNAME).ifPresent(userRepository::delete);
        userRepository.save(User.builder()
                .username(TEST_USERNAME)
                .email("perf_baseline@example.com")
                .fullName("Performance Baseline Staff")
                .password(passwordEncoder.encode(TEST_PASSWORD))
                .isActive(true)
                .approvalStatus("APPROVED")
                .tokenVersion(0L)
                .roles(new HashSet<>(Set.of(roleSales, roleInventory)))
                .build());
    }

    @Test
    @DisplayName("Measure Baseline Database Queries and Latencies")
    void measureBaseline() throws Exception {
        // 1. Measure direct loadUserByUsername
        stats.clear();
        long startUserLoad = System.nanoTime();
        userDetailsService.loadUserByUsername(TEST_USERNAME);
        long durUserLoad = (System.nanoTime() - startUserLoad) / 1_000_000;
        long queriesUserLoad = stats.getPrepareStatementCount();

        // 2. Measure Login
        LoginRequest loginRequest = new LoginRequest(TEST_USERNAME, TEST_PASSWORD);
        String loginBody = objectMapper.writeValueAsString(loginRequest);

        // Warm up login
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody));

        stats.clear();
        long startLogin = System.nanoTime();
        MvcResult loginResult = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andReturn();
        long durLogin = (System.nanoTime() - startLogin) / 1_000_000;
        long queriesLogin = stats.getPrepareStatementCount();

        // Extract token
        String token = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();
        assertNotNull(token);

        // 3. Measure Authenticated API request (e.g. GET /api/v1/auth/me)
        // Warm up /auth/me
        mvc.perform(get("/api/v1/auth/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token));

        stats.clear();
        long startMe = System.nanoTime();
        mvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
        long durMe = (System.nanoTime() - startMe) / 1_000_000;
        long queriesMe = stats.getPrepareStatementCount();

        // 4. Measure simple authenticated request to a business endpoint (e.g. GET /api/v1/products?size=1)
        stats.clear();
        long startProduct = System.nanoTime();
        mvc.perform(get("/api/v1/products")
                        .param("size", "1")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
        long durProduct = (System.nanoTime() - startProduct) / 1_000_000;
        long queriesProduct = stats.getPrepareStatementCount();

        System.out.println("=================================================================");
        System.out.println(">>> BASELINE AUTHENTICATION DATABASE PERFORMANCE MEASUREMENTS <<<");
        System.out.printf("1. loadUserByUsername Query Count:   %d queries | Duration: %d ms%n", queriesUserLoad, durUserLoad);
        System.out.printf("2. Login API Query Count:            %d queries | Latency:  %d ms%n", queriesLogin, durLogin);
        System.out.printf("3. /api/v1/auth/me Query Count:      %d queries | Latency:  %d ms%n", queriesMe, durMe);
        System.out.printf("4. Authenticated API Query Count:    %d queries | Latency:  %d ms%n", queriesProduct, durProduct);
        System.out.println("=================================================================");
    }
}
