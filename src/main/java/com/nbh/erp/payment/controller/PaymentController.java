package com.nbh.erp.payment.controller;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.payment.dto.CreatePaymentRequest;
import com.nbh.erp.payment.dto.PaymentDto;
import com.nbh.erp.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Customer Payments & Receipts", description = "Customer billing settlements and payment receipt APIs")
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_VIEW')")
    @Operation(summary = "Search customer payments and receipts history")
    public ResponseEntity<ApiResponse<PagedResponse<PaymentDto>>> searchPayments(
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long invoiceId,
            @RequestParam(required = false) String paymentType,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        PagedResponse<PaymentDto> response = paymentService.searchPayments(
                customerId, invoiceId, paymentType, paymentMethod, status, startDate, endDate, query, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_VIEW')")
    @Operation(summary = "Get single payment receipt by ID")
    public ResponseEntity<ApiResponse<PaymentDto>> getPaymentById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.getPaymentById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','PAYMENT_CREATE')")
    @Operation(summary = "Record customer payment / invoice settlement")
    public ResponseEntity<ApiResponse<PaymentDto>> processPayment(@Valid @RequestBody CreatePaymentRequest request) {
        PaymentDto payment = paymentService.processPayment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Payment receipt recorded successfully", payment));
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','PAYMENT_CREATE')")
    @Operation(summary = "Void customer payment receipt and restore invoice and customer balances")
    public ResponseEntity<ApiResponse<PaymentDto>> voidPayment(
            @PathVariable Long id,
            @RequestParam(required = false) String reason
    ) {
        PaymentDto payment = paymentService.voidPayment(id, reason);
        return ResponseEntity.ok(ApiResponse.ok("Payment receipt voided successfully", payment));
    }
    public record AllocationRequest(@jakarta.validation.constraints.NotNull Long invoiceId, @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive java.math.BigDecimal amount) {}
    @PostMapping("/{id}/allocations")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_CREATE')")
    public ResponseEntity<ApiResponse<PaymentDto>> allocate(@PathVariable Long id, @Valid @RequestBody AllocationRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.allocateAdvance(id,request.invoiceId(),request.amount())));
    }
}
