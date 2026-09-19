package com.nbh.erp.pdf.controller;

import com.nbh.erp.pdf.service.PdfGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pdf")
@RequiredArgsConstructor
@Tag(name = "PDF Generation", description = "Printable and downloadable PDF documents generation APIs")
public class PdfController {

    private final PdfGenerationService pdfService;

    @GetMapping("/invoices/{id}")
    @Operation(summary = "Generate and stream or download PDF for sales invoice")
    public ResponseEntity<byte[]> getInvoicePdf(
            @PathVariable Long id,
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        byte[] pdf = pdfService.generateInvoicePdf(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String disposition = download ? "attachment" : "inline";
        headers.set(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"invoice-" + id + ".pdf\"");

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    @GetMapping("/grns/{id}")
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
}
