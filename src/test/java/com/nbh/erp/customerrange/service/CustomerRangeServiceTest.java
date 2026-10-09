package com.nbh.erp.customerrange.service;

import com.nbh.erp.customerrange.entity.CustomerRangeConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CustomerRangeServiceTest {

    private CustomerRangeService service;
    private List<CustomerRangeConfig> sampleRanges;

    @BeforeEach
    void setUp() {
        // Instantiate service with null repositories since we are testing pure mathematical and range logic
        service = new CustomerRangeService(null, null, null, null, null, null, null);

        sampleRanges = List.of(
                CustomerRangeConfig.builder().id(1L).rangeCode("RANGE_0").name("Range 0").minSpend(BigDecimal.ZERO).displayOrder(0).isActive(true).build(),
                CustomerRangeConfig.builder().id(2L).rangeCode("RANGE_1").name("Range 1").minSpend(BigDecimal.valueOf(50000)).displayOrder(1).isActive(true).build(),
                CustomerRangeConfig.builder().id(3L).rangeCode("RANGE_2").name("Range 2").minSpend(BigDecimal.valueOf(150000)).displayOrder(2).isActive(true).build(),
                CustomerRangeConfig.builder().id(4L).rangeCode("RANGE_3").name("Range 3").minSpend(BigDecimal.valueOf(300000)).displayOrder(3).isActive(true).build(),
                CustomerRangeConfig.builder().id(5L).rangeCode("RANGE_4").name("Range 4").minSpend(BigDecimal.valueOf(500000)).displayOrder(4).isActive(true).build(),
                CustomerRangeConfig.builder().id(6L).rangeCode("RANGE_5").name("Range 5").minSpend(BigDecimal.valueOf(1000000)).displayOrder(5).isActive(true).build()
        );
    }

    @Test
    @DisplayName("RT-03: Zero purchases must resolve to Range 0")
    void testZeroPurchasesStartsAtRange0() {
        CustomerRangeConfig matched = service.determineRangeForAmount(sampleRanges, BigDecimal.ZERO);
        assertNotNull(matched);
        assertEquals("RANGE_0", matched.getRangeCode());
        assertEquals("Range 0", matched.getName());
    }

    @Test
    @DisplayName("Qualifying purchases below Range 1 threshold remain in Range 0")
    void testPurchasesBelow50000RemainRange0() {
        CustomerRangeConfig matched = service.determineRangeForAmount(sampleRanges, new BigDecimal("49999.99"));
        assertEquals("RANGE_0", matched.getRangeCode());
    }

    @Test
    @DisplayName("Reaching exactly Rs. 50,000 promotes customer to Range 1")
    void testReaching50000PromotesToRange1() {
        CustomerRangeConfig matched = service.determineRangeForAmount(sampleRanges, new BigDecimal("50000.00"));
        assertEquals("RANGE_1", matched.getRangeCode());
        assertEquals("Range 1", matched.getName());
    }

    @Test
    @DisplayName("Kamal Perera Example: October purchases Rs. 120,000 resolves to Range 1 and next target Range 2")
    void testKamalPereraOctoberPurchasesExample() {
        BigDecimal octoberPurchases = new BigDecimal("120000.00");

        // 1. Matched range must be Range 1
        CustomerRangeConfig current = service.determineRangeForAmount(sampleRanges, octoberPurchases);
        assertEquals("RANGE_1", current.getRangeCode());

        // 2. Next target must be Range 2 (threshold Rs. 150,000)
        CustomerRangeConfig next = service.findNextRange(sampleRanges, current);
        assertNotNull(next);
        assertEquals("RANGE_2", next.getRangeCode());
        assertEquals("Range 2", next.getName());
        assertEquals(0, new BigDecimal("150000.00").compareTo(next.getMinSpend()));

        // 3. Remaining amount must be exactly Rs. 30,000 (150,000 - 120,000)
        BigDecimal remaining = next.getMinSpend().subtract(octoberPurchases);
        assertEquals(0, new BigDecimal("30000.00").compareTo(remaining));
    }

    @Test
    @DisplayName("Highest range tier (Range 5) has no next range")
    void testHighestRangeTierHasNoNextTarget() {
        CustomerRangeConfig range5 = sampleRanges.get(5);
        CustomerRangeConfig next = service.findNextRange(sampleRanges, range5);
        assertNull(next, "Range 5 is the peak tier and should have null next range");
    }

    @Test
    @DisplayName("Option A: When November 1 resets purchases to Rs. 0, range returns to Range 0")
    void testNovember1ResetToRange0() {
        BigDecimal november1Purchases = BigDecimal.ZERO;
        CustomerRangeConfig resetRange = service.determineRangeForAmount(sampleRanges, november1Purchases);
        assertEquals("RANGE_0", resetRange.getRangeCode());
        assertEquals("Range 0", resetRange.getName());
    }
}
