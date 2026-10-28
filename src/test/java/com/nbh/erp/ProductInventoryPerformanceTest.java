package com.nbh.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.brand.repository.BrandRepository;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.inventory.dto.StockDto;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.dto.ProductDto;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.product.service.ProductService;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
public class ProductInventoryPerformanceTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private StockService stockService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private StockBalanceRepository stockBalanceRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private BrandRepository brandRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private WebApplicationContext webApplicationContext;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private MockMvc mockMvc;
    private String jwtToken;
    private boolean seeded = false;

    @BeforeEach
    public void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();

        if (!seeded) {
            seedTestData();
            seeded = true;
        }

        User user = userRepository.findByUsername("perf_admin").orElse(null);
        if (user != null) {
            UserPrincipal principal = UserPrincipal.create(user);
            jwtToken = jwtTokenProvider.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
            );
        }
    }

    private void seedTestData() {
        // Permissions and Role
        Permission viewProd = permissionRepository.findByName("PRODUCT_VIEW")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("PRODUCT_VIEW").module("PRODUCT").description("View products").build()));
        Permission viewInv = permissionRepository.findByName("INVENTORY_VIEW")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("INVENTORY_VIEW").module("INVENTORY").description("View inventory").build()));
        Permission viewCost = permissionRepository.findByName("COST_PRICE_VIEW")
                .orElseGet(() -> permissionRepository.save(Permission.builder().name("COST_PRICE_VIEW").module("INVENTORY").description("View cost prices").build()));

        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_ADMIN");
                    r.setDescription("Admin Role");
                    r.setPermissions(new HashSet<>(Set.of(viewProd, viewInv, viewCost)));
                    return roleRepository.save(r);
                });

        User u = userRepository.findByUsername("perf_admin")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("perf_admin")
                        .email("perf_admin@nbh.com")
                        .fullName("Performance Admin")
                        .password(passwordEncoder.encode("Password123!"))
                        .roles(new HashSet<>(Set.of(adminRole)))
                        .isActive(true)
                        .approvalStatus("APPROVED")
                        .tokenVersion(0L)
                        .build()));
        u.setApprovalStatus("APPROVED");
        u.setIsActive(true);
        u.setTokenVersion(0L);
        u.setRoles(new HashSet<>(Set.of(adminRole)));
        userRepository.save(u);

        // Warehouses
        Warehouse wh1 = warehouseRepository.findByCode("WH-P1")
                .orElseGet(() -> warehouseRepository.save(Warehouse.builder().code("WH-P1").name("Central Hub").isActive(true).build()));
        Warehouse wh2 = warehouseRepository.findByCode("WH-P2")
                .orElseGet(() -> warehouseRepository.save(Warehouse.builder().code("WH-P2").name("North Warehouse").isActive(true).build()));

        // Categories
        Category cat1 = categoryRepository.findByCode("CAT-BEV")
                .orElseGet(() -> categoryRepository.save(Category.builder().code("CAT-BEV").name("Beverages").isActive(true).build()));
        Category cat2 = categoryRepository.findByCode("CAT-SNK")
                .orElseGet(() -> categoryRepository.save(Category.builder().code("CAT-SNK").name("Snacks").isActive(true).build()));
        Category cat3 = categoryRepository.findByCode("CAT-DRY")
                .orElseGet(() -> categoryRepository.save(Category.builder().code("CAT-DRY").name("Dairy").isActive(true).build()));

        // Brands
        Brand brand1 = brandRepository.findByCode("BRD-A")
                .orElseGet(() -> brandRepository.save(Brand.builder().code("BRD-A").name("Brand Alpha").isActive(true).build()));
        Brand brand2 = brandRepository.findByCode("BRD-B")
                .orElseGet(() -> brandRepository.save(Brand.builder().code("BRD-B").name("Brand Beta").isActive(true).build()));

        // Suppliers
        Supplier sup1 = supplierRepository.findBySupplierCode("SUP-P1")
                .orElseGet(() -> supplierRepository.save(Supplier.builder().name("Supplier Direct").supplierCode("SUP-P1").isActive(true).build()));

        // Seed 30 Products
        List<Product> products = new ArrayList<>();
        for (int i = 1; i <= 30; i++) {
            Category cat = (i % 3 == 0) ? cat3 : (i % 2 == 0) ? cat2 : cat1;
            Brand brand = (i % 2 == 0) ? brand2 : brand1;
            String sku = "SKU-PERF-" + String.format("%03d", i);
            String barcode = "BAR-PERF-" + String.format("%03d", i);
            final int index = i;
            Product p = productRepository.findBySku(sku)
                    .orElseGet(() -> productRepository.save(Product.builder()
                            .sku(sku)
                            .barcode(barcode)
                            .name("Performance Test Product " + index)
                            .category(cat)
                            .brand(brand)
                            .defaultSupplier(sup1)
                            .defaultWarehouse(wh1)
                            .unitOfMeasure("PCS")
                            .costPrice(new BigDecimal(10 + index))
                            .sellingPrice(new BigDecimal(20 + index))
                            .useBrandMarkup(index % 2 == 0)
                            .minStockLevel(5)
                            .isActive(true)
                            .build()));
            products.add(p);
        }

        // Seed Stock Balances for the products
        for (int i = 0; i < products.size(); i++) {
            Product p = products.get(i);
            Warehouse wh = (i % 2 == 0) ? wh1 : wh2;
            final int index = i;
            stockBalanceRepository.findByWarehouseIdAndProductId(wh.getId(), p.getId())
                    .orElseGet(() -> stockBalanceRepository.save(StockBalance.builder()
                            .product(p)
                            .warehouse(wh)
                            .quantity(new BigDecimal(50 + index))
                            .reservedQuantity(new BigDecimal(2))
                            .build()));
        }
    }

    @Test
    @DisplayName("Verify Product searchPaginated executes exactly 2 SQL queries (no N+1)")
    public void testProductSearchPaginatedQueryCount() {
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        long startTime = System.currentTimeMillis();
        PagedResponse<ProductDto> result = productService.getProductsPaginated("SKU-PERF", null, PageRequest.of(0, 20));
        long latencyMs = System.currentTimeMillis() - startTime;

        long queryCount = stats.getPrepareStatementCount();

        System.out.println("=================================================================");
        System.out.println(">>> PRODUCT PAGINATION PERFORMANCE MEASUREMENT <<<");
        System.out.println("Page Size:               20 products");
        System.out.println("Returned Elements:       " + result.getContent().size());
        System.out.println("Total SQL Query Count:   " + queryCount + " queries (target: <= 2)");
        System.out.println("Service Latency:         " + latencyMs + " ms");
        System.out.println("=================================================================");

        assertNotNull(result);
        assertFalse(result.getContent().isEmpty());
        // 1 query for products with LEFT JOIN FETCH + 1 countQuery for pagination total
        assertTrue(queryCount <= 2, "Query count should be at most 2 (1 fetch join query + 1 count query), but was: " + queryCount);

        // Verify relationships are mapped without triggering lazy loading
        ProductDto first = result.getContent().get(0);
        assertNotNull(first.getCategoryName(), "Category name must be loaded in DTO");
        assertNotNull(first.getBrandName(), "Brand name must be loaded in DTO");
        assertNotNull(first.getSupplierName(), "Supplier name must be loaded in DTO");
        assertNotNull(first.getWarehouseName(), "Warehouse name must be loaded in DTO");
    }

    @Test
    @DisplayName("Verify StockBalance searchBalances executes exactly 2 SQL queries (no N+1)")
    public void testStockBalanceSearchBalancesQueryCount() {
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        long startTime = System.currentTimeMillis();
        Page<StockDto> result = stockService.searchBalances(null, "SKU-PERF", PageRequest.of(0, 20));
        long latencyMs = System.currentTimeMillis() - startTime;

        long queryCount = stats.getPrepareStatementCount();

        System.out.println("=================================================================");
        System.out.println(">>> STOCK BALANCE SEARCH PERFORMANCE MEASUREMENT <<<");
        System.out.println("Page Size:               20 balances");
        System.out.println("Returned Elements:       " + result.getContent().size());
        System.out.println("Total SQL Query Count:   " + queryCount + " queries (target: <= 2)");
        System.out.println("Service Latency:         " + latencyMs + " ms");
        System.out.println("=================================================================");

        assertNotNull(result);
        assertFalse(result.getContent().isEmpty());
        // 1 query for balances with JOIN FETCH + 1 countQuery for pagination total
        assertTrue(queryCount <= 2, "Query count should be at most 2 (1 fetch join query + 1 count query), but was: " + queryCount);

        // Verify enriched fields are directly present
        StockDto first = result.getContent().get(0);
        assertNotNull(first.getWarehouseName(), "Warehouse name must be directly loaded in StockDto");
        assertNotNull(first.getProductName(), "Product name must be directly loaded in StockDto");
        assertNotNull(first.getProductSku(), "Product SKU must be directly loaded in StockDto");
        assertNotNull(first.getBrandName(), "Brand name must be directly loaded in StockDto");
        assertNotNull(first.getCategoryName(), "Category name must be directly loaded in StockDto");
        assertNotNull(first.getSellingPrice(), "Selling price must be loaded in StockDto");
    }

    @Test
    @DisplayName("Verify StockDto cost price security masking")
    @org.springframework.transaction.annotation.Transactional
    public void testStockDtoSecurityMasking() {
        StockBalance sb = stockBalanceRepository.findAllWithProductAndWarehouse(null).stream().filter(b -> b.getProduct() != null && b.getProduct().getBrand() != null).findFirst().orElseThrow();

        // Allowed
        StockDto allowed = StockDto.from(sb, true);
        assertNotNull(allowed.getCostPrice(), "Authorized caller should see cost price");
        assertNotNull(allowed.getTotalCostValue(), "Authorized caller should see total cost value");

        // Redacted
        StockDto redacted = StockDto.from(sb, false);
        assertNull(redacted.getCostPrice(), "Unauthorized caller must have costPrice null");
        assertNull(redacted.getTotalCostValue(), "Unauthorized caller must have totalCostValue null");
        assertNotNull(redacted.getSellingPrice(), "Selling price must still be visible");
        assertNotNull(redacted.getBrandName(), "Brand name must be visible");
        assertNotNull(redacted.getCategoryName(), "Category name must be visible");
    }

    @Test
    @DisplayName("Verify HTTP API response latency and payload size for products and inventory balances")
    public void testHttpEndpointPerformance() throws Exception {
        // Test /api/v1/products
        long pStart = System.currentTimeMillis();
        MvcResult pResult = mockMvc.perform(get("/api/v1/products?page=0&size=20")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andReturn();
        long pLatency = System.currentTimeMillis() - pStart;
        byte[] pBytes = pResult.getResponse().getContentAsByteArray();

        // Test /api/v1/inventory/balances
        long bStart = System.currentTimeMillis();
        MvcResult bResult = mockMvc.perform(get("/api/v1/inventory/balances?page=0&size=20")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andReturn();
        long bLatency = System.currentTimeMillis() - bStart;
        byte[] bBytes = bResult.getResponse().getContentAsByteArray();

        System.out.println("=================================================================");
        System.out.println(">>> REST ENDPOINTS HTTP BENCHMARK <<<");
        System.out.println("GET /api/v1/products (size=20):           " + pLatency + " ms (" + pBytes.length + " bytes / " + String.format("%.2f", pBytes.length / 1024.0) + " KB)");
        System.out.println("GET /api/v1/inventory/balances (size=20): " + bLatency + " ms (" + bBytes.length + " bytes / " + String.format("%.2f", bBytes.length / 1024.0) + " KB)");
        System.out.println("=================================================================");

        assertTrue(pBytes.length > 0);
        assertTrue(bBytes.length > 0);
    }
}
