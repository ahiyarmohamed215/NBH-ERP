package com.nbh.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.brand.repository.BrandRepository;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.dashboard.dto.DashboardDto;
import com.nbh.erp.dashboard.service.DashboardService;
import com.nbh.erp.delivery.entity.Delivery;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.repository.DeliveryRepository;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class DashboardPerformanceTest {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private GrnRepository grnRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private BrandRepository brandRepository;

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
    private DeliveryRepository deliveryRepository;

    @Autowired
    private DeliveryRouteRepository deliveryRouteRepository;

    @Autowired
    private StockBalanceRepository stockBalanceRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private Statistics stats;

    @BeforeEach
    void setupTestData() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);

        // Clean existing test records if any
        stockBalanceRepository.deleteAll();
        invoiceRepository.deleteAll();
        grnRepository.deleteAll();

        // 1. Base references
        Customer customer = customerRepository.findByCustomerCode("CUST-DASH-1")
                .orElseGet(() -> customerRepository.save(Customer.builder()
                        .customerCode("CUST-DASH-1")
                        .name("Dashboard Test Customer")
                        .isActive(true)
                        .creditLimit(new BigDecimal("500000"))
                        .build()));

        Warehouse warehouse = warehouseRepository.findByCode("WH-DASH-1")
                .orElseGet(() -> warehouseRepository.save(Warehouse.builder()
                        .code("WH-DASH-1")
                        .name("Dashboard Main Warehouse")
                        .build()));

        Supplier supplier = supplierRepository.findBySupplierCode("SUP-DASH-1")
                .orElseGet(() -> supplierRepository.save(Supplier.builder()
                        .supplierCode("SUP-DASH-1")
                        .name("Dashboard Test Supplier")
                        .status("ACTIVE")
                        .isActive(true)
                        .build()));

        Category category = categoryRepository.findByCode("CAT-DASH")
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .code("CAT-DASH")
                        .name("Dashboard Category")
                        .status("ACTIVE")
                        .build()));

        Brand brand = brandRepository.findByCode("BRAND-DASH")
                .orElseGet(() -> brandRepository.save(Brand.builder()
                        .code("BRAND-DASH")
                        .name("Brand-Dash")
                        .build()));

        User driver = userRepository.findByUsername("dash_driver")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("dash_driver")
                        .email("dash_driver@nbh.com")
                        .fullName("Dashboard Lead Driver")
                        .password("Password123!")
                        .isActive(true)
                        .approvalStatus("APPROVED")
                        .tokenVersion(0L)
                        .build()));

        User helper = userRepository.findByUsername("dash_helper")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("dash_helper")
                        .email("dash_helper@nbh.com")
                        .fullName("Dashboard Delivery Assistant")
                        .password("Password123!")
                        .isActive(true)
                        .approvalStatus("APPROVED")
                        .tokenVersion(0L)
                        .build()));

        DeliveryRoute route = deliveryRouteRepository.findByRouteCode("DR-DASH-1")
                .orElseGet(() -> deliveryRouteRepository.save(DeliveryRoute.builder()
                        .routeCode("DR-DASH-1")
                        .routeName("Dashboard Delivery Route")
                        .isActive(true)
                        .build()));

        Delivery delivery = deliveryRepository.findByDeliveryNumber("DEL-DASH-001")
                .orElseGet(() -> deliveryRepository.save(Delivery.builder()
                        .deliveryNumber("DEL-DASH-001")
                        .warehouse(warehouse)
                        .route(route)
                        .vehicleNumber("WP-CA-1234")
                        .driver(driver)
                        .assistantStaff(helper)
                        .scheduledDate(LocalDate.now())
                        .status("DELIVERED")
                        .build()));

        // Products
        List<Product> products = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            final String sku = "SKU-DASH-" + i;
            Product p = productRepository.findBySku(sku)
                    .orElseGet(() -> productRepository.save(Product.builder()
                            .sku(sku)
                            .barcode("BAR-DASH-" + sku)
                            .name("Dashboard Product " + sku)
                            .category(category)
                            .brand(brand)
                            .defaultSupplier(supplier)
                            .defaultWarehouse(warehouse)
                            .costPrice(new BigDecimal("100.00"))
                            .sellingPrice(new BigDecimal("150.00"))
                            .unitOfMeasure("PCS")
                            .minStockLevel(10)
                            .isActive(true)
                            .build()));
            products.add(p);
        }

        // Add stock balance
        for (Product p : products) {
            stockBalanceRepository.save(StockBalance.builder()
                    .warehouse(warehouse)
                    .product(p)
                    .quantity(new BigDecimal("20.00"))
                    .reservedQuantity(BigDecimal.ZERO)
                    .build());
        }

        // 2. Create 5 Invoices with multiple items & deliveries
        for (int i = 1; i <= 5; i++) {
            Invoice inv = Invoice.builder()
                    .invoiceNumber("INV-DASH-2026-" + String.format("%03d", i))
                    .customer(customer)
                    .warehouse(warehouse)
                    .salesRep(driver)
                    .status(i == 5 ? "HELD" : (i % 2 == 0 ? "COMPLETED" : "PAID"))
                    .paymentType("CASH")
                    .netTotal(new BigDecimal("4500.00"))
                    .subtotal(new BigDecimal("4500.00"))
                    .taxAmount(BigDecimal.ZERO)
                    .discountAmount(BigDecimal.ZERO)
                    .paidAmount(new BigDecimal("4500.00"))
                    .balanceAmount(BigDecimal.ZERO)
                    .invoiceDate(LocalDate.now())
                    .delivery(delivery)
                    .deliveryStatus("DELIVERED")
                    .deliveryDate(LocalDate.now())
                    .build();

            List<InvoiceItem> items = new ArrayList<>();
            for (Product p : products) {
                items.add(InvoiceItem.builder()
                        .invoice(inv)
                        .product(p)
                        .quantity(new BigDecimal("3"))
                        .unitPrice(new BigDecimal("150.00"))
                        .costPrice(new BigDecimal("100.00"))
                        .totalPrice(new BigDecimal("450.00"))
                        .discountAmount(BigDecimal.ZERO)
                        .discountRate(BigDecimal.ZERO)
                        .build());
            }
            inv.setItems(items);
            invoiceRepository.save(inv);
        }

        // 3. Create 5 GRNs with multiple items
        for (int i = 1; i <= 5; i++) {
            Grn grn = Grn.builder()
                    .grnNumber("GRN-DASH-2026-" + String.format("%03d", i))
                    .supplier(supplier)
                    .warehouse(warehouse)
                    .status("PROCESSED")
                    .grnType("Standard Inward")
                    .totalAmount(new BigDecimal("5000.00"))
                    .receivedDate(LocalDate.now())
                    .build();

            List<GrnItem> grnItems = new ArrayList<>();
            for (Product p : products) {
                grnItems.add(GrnItem.builder()
                        .grn(grn)
                        .product(p)
                        .warehouse(warehouse)
                        .quantityReceived(new BigDecimal("10"))
                        .unitCost(new BigDecimal("100.00"))
                        .totalCost(new BigDecimal("1000.00"))
                        .sellingPrice(new BigDecimal("150.00"))
                        .build());
            }
            grn.setItems(grnItems);
            grnRepository.save(grn);
        }
    }

    @Test
    @DisplayName("1. Measure Dashboard Performance, Query Count, and Component Breakdown")
    void measureDashboardPerformanceAndQueryCount() throws Exception {
        // Measure Recent Invoices standalone
        stats.clear();
        long startInv = System.nanoTime();
        List<InvoiceDto> recentInvoices = invoiceRepository
                .findRecentInvoices(PageRequest.of(0, 5))
                .stream()
                .map(InvoiceDto::fromSummary)
                .collect(Collectors.toList());
        long durInv = (System.nanoTime() - startInv) / 1_000_000;
        long queriesInv = stats.getPrepareStatementCount();

        // Measure Recent GRNs standalone
        stats.clear();
        long startGrn = System.nanoTime();
        List<GrnDto> recentGrns = grnRepository
                .findRecentGrns(PageRequest.of(0, 5))
                .stream()
                .map(GrnDto::fromSummary)
                .collect(Collectors.toList());
        long durGrn = (System.nanoTime() - startGrn) / 1_000_000;
        long queriesGrn = stats.getPrepareStatementCount();

        // Measure Full Dashboard Summary
        stats.clear();
        long startFull = System.nanoTime();
        DashboardDto dashboard = dashboardService.getDashboardSummary();
        long durationMs = (System.nanoTime() - startFull) / 1_000_000;
        long totalQueries = stats.getPrepareStatementCount();

        String jsonPayload = objectMapper.writeValueAsString(dashboard);
        int payloadBytes = jsonPayload.getBytes().length;

        System.out.println("=================================================================");
        System.out.println(">>> TASK 5 OPTIMIZED DASHBOARD PERFORMANCE MEASUREMENT <<<");
        System.out.printf("Recent Invoices Standalone Queries:  %d queries (took %d ms)%n", queriesInv, durInv);
        System.out.printf("Recent GRNs Standalone Queries:      %d queries (took %d ms)%n", queriesGrn, durGrn);
        System.out.printf("Total Full Dashboard Queries:        %d queries%n", totalQueries);
        System.out.printf("Full Dashboard Latency:              %d ms%n", durationMs);
        System.out.printf("Response Payload Size:               %d bytes (%.2f KB)%n", payloadBytes, payloadBytes / 1024.0);
        System.out.printf("Recent Invoices Count:               %d%n", dashboard.getRecentInvoices().size());
        System.out.printf("Recent GRNs Count:                   %d%n", dashboard.getRecentGrns().size());
        System.out.println("=================================================================");

        assertEquals(1, queriesInv, "Recent invoices must execute in exactly 1 query");
        assertEquals(1, queriesGrn, "Recent GRNs must execute in exactly 1 query");
        assertTrue(totalQueries <= 7, "Total dashboard queries should be <= 7 (reduced from 25)");
        assertTrue(payloadBytes < 10000, "Payload size should be reduced from 19KB to <10KB");
    }

    @Test
    @DisplayName("2. Verify Data Integrity, Formatting, and Calculation Correctness")
    void verifyDataIntegrityAndFieldExactness() {
        DashboardDto dashboard = dashboardService.getDashboardSummary();

        // 4 completed/paid invoices * 4500 = 18000.00
        assertEquals(0, new BigDecimal("18000.00").compareTo(dashboard.getTodaySales()));
        assertEquals(4, dashboard.getTodayOrders());
        assertEquals(1, dashboard.getHeldInvoicesCount());

        // Inventory valuation: 4 products * 20 qty * 100 cost = 8000.00
        assertEquals(0, new BigDecimal("8000.00").compareTo(dashboard.getTotalInventoryValue()));

        // Invoices verification
        List<InvoiceDto> invoices = dashboard.getRecentInvoices();
        assertEquals(5, invoices.size());
        for (InvoiceDto inv : invoices) {
            assertNotNull(inv.getId());
            assertNotNull(inv.getInvoiceNumber());
            assertEquals("Dashboard Test Customer", inv.getCustomerName());
            assertEquals("Dashboard Main Warehouse", inv.getWarehouseName());
            assertEquals(0, new BigDecimal("4500.00").compareTo(inv.getNetTotal()));
            assertNotNull(inv.getStatus());
            assertNotNull(inv.getItems());
            assertTrue(inv.getItems().isEmpty(), "Dashboard summary does not need bloated items");
        }

        // GRNs verification
        List<GrnDto> grns = dashboard.getRecentGrns();
        assertEquals(5, grns.size());
        for (GrnDto grn : grns) {
            assertNotNull(grn.getId());
            assertNotNull(grn.getGrnNumber());
            assertEquals("Dashboard Test Supplier", grn.getSupplierName());
            assertEquals("Dashboard Main Warehouse", grn.getWarehouseName());
            assertEquals(0, new BigDecimal("5000.00").compareTo(grn.getTotalAmount()));
            assertEquals("PROCESSED", grn.getStatus());
            assertNotNull(grn.getItems());
            assertTrue(grn.getItems().isEmpty(), "Dashboard summary does not need bloated items");
        }
    }

    @Test
    @DisplayName("3. Verify Endpoint Authorization (Admin vs Unauthenticated)")
    void verifyEndpointAuthorization() throws Exception {
        // 1. Unauthenticated request must be denied (401/403)
        mvc.perform(get("/api/v1/dashboard/summary"))
                .andExpect(status().isUnauthorized());

        // 2. Authenticated user with DASHBOARD_VIEW permission
        Permission p = permissionRepository.findByName("DASHBOARD_VIEW")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("DASHBOARD_VIEW").module("DASHBOARD").build()));

        Role role = roleRepository.findByName("ROLE_DASH_VIEWER")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ROLE_DASH_VIEWER")
                        .description("Dashboard Viewer")
                        .permissions(new HashSet<>(Set.of(p)))
                        .build()));

        User user = userRepository.findByUsername("dash_viewer_user")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("dash_viewer_user")
                        .email("dash_viewer@nbh.com")
                        .fullName("Dashboard Viewer Staff")
                        .password(passwordEncoder.encode("Password123!"))
                        .isActive(true)
                        .approvalStatus("APPROVED")
                        .tokenVersion(0L)
                        .roles(new HashSet<>(Set.of(role)))
                        .build()));

        UserPrincipal principal = UserPrincipal.create(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        String token = tokenProvider.generateAccessToken(auth);

        // 3. Authenticated request succeeds
        mvc.perform(get("/api/v1/dashboard/summary")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }
}
