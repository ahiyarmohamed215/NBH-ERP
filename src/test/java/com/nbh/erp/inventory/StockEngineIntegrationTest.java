package com.nbh.erp.inventory;

import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.exception.InsufficientStockException;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.inventory.repository.StockMovementRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class StockEngineIntegrationTest {

    @Autowired
    private StockService stockService;

    @Autowired
    private StockBalanceRepository stockBalanceRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    private Warehouse wh1;
    private Warehouse wh2;
    private Product testProduct;

    @BeforeEach
    void setUp() {
        Category category = categoryRepository.findByCode("CAT-GEN")
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .code("CAT-TEST")
                        .name("Test Category")
                        .build()));

        wh1 = warehouseRepository.findByCode("WH-MAIN")
                .orElseGet(() -> warehouseRepository.save(Warehouse.builder()
                        .code("WH-TEST1")
                        .name("Test Warehouse 1")
                        .isPrimary(true)
                        .build()));

        wh2 = warehouseRepository.findByCode("WH-SECONDARY")
                .orElseGet(() -> warehouseRepository.save(Warehouse.builder()
                        .code("WH-TEST2")
                        .name("Test Warehouse 2")
                        .isPrimary(false)
                        .build()));

        testProduct = productRepository.findBySku("TEST-PRD-001")
                .orElseGet(() -> productRepository.save(Product.builder()
                        .sku("TEST-PRD-001")
                        .name("Test Widget")
                        .category(category)
                        .costPrice(new BigDecimal("10.00"))
                        .sellingPrice(new BigDecimal("15.00"))
                        .minStockLevel(5)
                        .build()));
    }

    @Test
    @DisplayName("Scenario 1: GRN increases stock balance and creates immutable ledger movement")
    void testIncreaseStock() {
        stockService.increaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("50"),
                new BigDecimal("10.00"),
                "GRN",
                "GRN-2026-TEST01",
                "Initial stock intake"
        );

        BigDecimal available = stockService.getAvailableStock(wh1.getId(), testProduct.getId());
        assertEquals(0, new BigDecimal("50").compareTo(available));

        var movements = stockMovementRepository.findByProductIdAndWarehouseIdOrderByCreatedAtDesc(testProduct.getId(), wh1.getId());
        assertFalse(movements.isEmpty());
        assertEquals("GRN", movements.get(0).getMovementType());
        assertEquals(0, new BigDecimal("50").compareTo(movements.get(0).getQuantity()));
    }

    @Test
    @DisplayName("Scenario 2: Sale decreases stock balance accurately")
    void testDecreaseStock() {
        stockService.increaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("20"),
                new BigDecimal("10.00"),
                "GRN",
                "GRN-2026-TEST02",
                "Intake for sale test"
        );

        stockService.decreaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("7"),
                "SALE",
                "INV-2026-TEST01",
                "Sale of 7 items"
        );

        BigDecimal remaining = stockService.getAvailableStock(wh1.getId(), testProduct.getId());
        assertEquals(0, new BigDecimal("13").compareTo(remaining));
    }

    @Test
    @DisplayName("Scenario 3: Over-allocation beyond available stock throws InsufficientStockException")
    void testInsufficientStockThrowsException() {
        stockService.increaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("5"),
                new BigDecimal("10.00"),
                "GRN",
                "GRN-2026-TEST03",
                "Small intake"
        );

        assertThrows(InsufficientStockException.class, () -> {
            stockService.decreaseStock(
                    wh1.getId(),
                    testProduct.getId(),
                    new BigDecimal("10"), // Demanding 10 when only 5 exist
                    "SALE",
                    "INV-2026-TEST02",
                    "Exceeding sale"
            );
        });
    }

    @Test
    @DisplayName("Scenario 4: GTN Transfer decreases source and increases destination warehouse inventory")
    void testTransferStock() {
        stockService.increaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("30"),
                new BigDecimal("10.00"),
                "GRN",
                "GRN-2026-TEST04",
                "Transfer base"
        );

        stockService.transferStock(
                wh1.getId(),
                wh2.getId(),
                testProduct.getId(),
                new BigDecimal("12"),
                "GTN-2026-TEST01",
                "Transfer to secondary branch"
        );

        BigDecimal wh1Balance = stockService.getAvailableStock(wh1.getId(), testProduct.getId());
        BigDecimal wh2Balance = stockService.getAvailableStock(wh2.getId(), testProduct.getId());

        assertEquals(0, new BigDecimal("18").compareTo(wh1Balance));
        assertEquals(0, new BigDecimal("12").compareTo(wh2Balance));
    }

    @Test
    @DisplayName("Scenario 5: Physical stock audit adjustment corrects system discrepancies")
    void testStockAdjustment() {
        stockService.increaseStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("25"),
                new BigDecimal("10.00"),
                "GRN",
                "GRN-2026-TEST05",
                "Base stock"
        );

        // System says 25, physical count reveals 22 (3 units lost or broken)
        stockService.adjustStock(
                wh1.getId(),
                testProduct.getId(),
                new BigDecimal("22"),
                "ADJ-2026-TEST01",
                "Physical inventory audit shrinkage"
        );

        BigDecimal afterAdj = stockService.getAvailableStock(wh1.getId(), testProduct.getId());
        assertEquals(0, new BigDecimal("22").compareTo(afterAdj));
    }
}
