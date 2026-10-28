package com.nbh.erp.pdf.controller;

import com.nbh.erp.pdf.service.PdfGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pdf")
@RequiredArgsConstructor
@Tag(name = "PDF Generation", description = "Printable and downloadable PDF documents generation APIs")
public class PdfController {

    private final PdfGenerationService pdfService;
    private final com.nbh.erp.sales.service.InvoiceService invoiceService;

    @GetMapping("/invoices/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SALES')")
    @Operation(summary = "Generate and stream or download PDF for sales invoice")
    public ResponseEntity<byte[]> getInvoicePdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        var bill = invoiceService.getInvoiceById(id);
        byte[] pdf = pdfService.generateInvoicePdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        boolean warehouseReview = bill.getInvoiceNumber() == null || java.util.Set.of(
                "YET_TO_PRINT", "HELD", "SENT_TO_WAREHOUSE", "STOCK_ADJUSTED", "POS_ONHOLD")
                .contains(java.util.Objects.toString(bill.getStatus(), "").toUpperCase(java.util.Locale.ROOT));
        String filename = warehouseReview
                ? "Onhold Bill WH Review Copy-" + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Colombo")) + "-" + bill.getHeldNumber() + ".pdf"
                : "invoice-" + id + ".pdf";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + filename + "\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/grns/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('GRN')")
    @Operation(summary = "Generate and stream or download PDF for GRN intake")
    public ResponseEntity<byte[]> getGrnPdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateGrnPdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"grn-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/gtns/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('GTN')")
    @Operation(summary = "Generate and stream or download PDF for GTN transfer")
    public ResponseEntity<byte[]> getGtnPdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateGtnPdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"gtn-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/customers/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('CUSTOMER')")
    @Operation(summary = "Generate and stream or download PDF for customer profile & statement")
    public ResponseEntity<byte[]> getCustomerPdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateCustomerPdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"customer-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/customers")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('CUSTOMER')")
    @Operation(summary = "Generate and stream or download PDF for full customer directory")
    public ResponseEntity<byte[]> getCustomerListPdf(
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateCustomerListPdf();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"customers-directory.pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/customer-groups/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('CUSTOMER')")
    @Operation(summary = "Generate and stream or download PDF for customer group roster")
    public ResponseEntity<byte[]> getCustomerGroupPdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateCustomerGroupPdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"customer-group-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/customers/{id}/history")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('CUSTOMER')")
    @Operation(summary = "Generate and stream or download PDF for customer ledger history")
    public ResponseEntity<byte[]> getCustomerHistoryPdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateCustomerHistoryPdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"customer-ledger-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/employees")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('USER')")
    @Operation(summary = "Generate and stream or download PDF for employee directory")
    public ResponseEntity<byte[]> getEmployeeListPdf(
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateEmployeeListPdf();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"employees-directory.pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/employees/{id}")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('USER')")
    @Operation(summary = "Generate and stream or download PDF for employee profile card")
    public ResponseEntity<byte[]> getEmployeePdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateEmployeePdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"employee-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
