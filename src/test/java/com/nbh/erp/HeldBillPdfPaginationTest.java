package com.nbh.erp;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.nbh.erp.pdf.service.PdfGenerationService;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.customer.entity.Customer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HeldBillPdfPaginationTest {
    @ParameterizedTest
    @ValueSource(ints = {0, 1, 17, 18, 19, 25, 35, 36, 37})
    void everyPageHasAtMostEighteenProductsAndBothStaffSignatures(int itemCount) throws Exception {
        var repository = mock(InvoiceRepository.class);
        var service = new PdfGenerationService(repository, null, null, null, null, null);
        var bill = new Invoice();
        bill.setId(1L);
        bill.setHeldNumber("HLD-PAGES");
        bill.setStatus("SENT_TO_WAREHOUSE");
        bill.setInvoiceDate(LocalDate.of(2026, 10, 24));
        bill.setCreatedAt(java.time.LocalDateTime.of(2026, 10, 23, 8, 10));
        bill.setOriginalHeldCapturedAt(java.time.LocalDateTime.of(2026, 10, 24, 15, 45));
        bill.setCustomer(Customer.builder().name("Page customer").customerCode("CUS-01").address("No. 24, Main Street, Weligama").isActive(true).build());
        bill.setItems(new ArrayList<>());
        for (int i = 1; i <= itemCount; i++) {
            var item = new InvoiceItem();
            item.setProduct(Product.builder().sku(String.format("SKU-%03d", i)).name("Product " + i).build());
            item.setQuantity(BigDecimal.valueOf(2));
            bill.getItems().add(item);
        }
        when(repository.findById(1L)).thenReturn(Optional.of(bill));
        byte[] pdf = service.generateInvoicePdf(1L);
        // Optional local render fixture, kept out of normal test runs.
        String previewDirectory = System.getProperty("held.print.previewDir");
        if ((itemCount == 18 || itemCount == 25) && previewDirectory != null) {
            var directory = java.nio.file.Path.of(previewDirectory);
            java.nio.file.Files.createDirectories(directory);
            java.nio.file.Files.write(directory.resolve("warehouse-server-" + itemCount + ".pdf"), pdf);
        }
        try (var reader = new PdfReader(pdf)) {
            int pages = Math.max(1, (itemCount + 17) / 18);
            assertEquals(pages, reader.getNumberOfPages());
            var extractor = new PdfTextExtractor(reader);
            for (int page = 1; page <= pages; page++) {
                String text = extractor.getTextFromPage(page).replaceAll("\\s+", " ");
                assertTrue(text.contains("Onhold bill"));
                assertTrue(text.contains("HLD-PAGES"));
                assertTrue(text.contains("Page customer"));
                assertTrue(text.contains("CUSTOMER DETAILS"));
                assertTrue(text.contains("CUS-01"));
                assertTrue(text.contains("No. 24, Main Street, Weligama"));
                assertFalse(text.contains("CUSTOMER ADDRESS"));
                assertFalse(text.contains("Code:"));
                assertTrue(text.contains("BILLED AT"));
                assertTrue(text.contains("24 Oct 2026, 03:45 PM"));
                assertTrue(java.util.regex.Pattern.compile("Generated .*?\\d{2}:\\d{2} (AM|PM)").matcher(text).find());
                assertTrue(text.contains("Packing counts"));
                assertFalse(text.contains("Warehouse keeper: write the number of packages"));
                assertTrue(text.contains("Collected by"));
                assertTrue(text.contains("Checked by / warehouse keeper"));
                assertTrue(text.contains("Name & Signature"));
                assertTrue(text.contains("Start time") && text.contains("End time") && text.contains("Date"));
                assertTrue(text.contains("Page " + page + " of " + pages));
                int first = (page - 1) * 18 + 1;
                int last = Math.min(page * 18, itemCount);
                for (int i = 1; i <= itemCount; i++) {
                    assertEquals(i >= first && i <= last, text.contains(String.format("SKU-%03d", i)),
                            "Product " + i + " on page " + page);
                }
            }
        }

    }
}
