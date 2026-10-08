package com.nbh.erp.salesreturn.controller;
import com.nbh.erp.salesreturn.service.CreditNoteService;
import com.nbh.erp.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import lombok.RequiredArgsConstructor;
@RestController @RequestMapping("/api/v1/credit-notes") @RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_VIEW')")
public class CreditNoteController {
 private final CreditNoteService service;
 @GetMapping public ApiResponse<?> list() { return ApiResponse.ok(service.list()); }
 @GetMapping("/{id}/allocations") public ApiResponse<?> allocations(@PathVariable Long id) { return ApiResponse.ok(service.allocations(id)); }
 public record Apply(@jakarta.validation.constraints.NotNull Long invoiceId,@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive java.math.BigDecimal amount) {}
 @PostMapping("/{id}/apply") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_CREATE')")
 public ApiResponse<?> apply(@PathVariable Long id,@jakarta.validation.Valid @RequestBody Apply req) { return ApiResponse.ok(service.apply(id,req.invoiceId(),req.amount())); }
 @PostMapping("/allocations/{id}/reverse") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_CREATE')")
 public ApiResponse<?> reverse(@PathVariable Long id,@RequestBody java.util.Map<String,String> req) { service.reverse(id,req.get("reason"));return ApiResponse.ok("Reversed",null); }
}
