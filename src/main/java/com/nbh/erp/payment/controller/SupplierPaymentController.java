package com.nbh.erp.payment.controller;
import com.nbh.erp.payment.service.SupplierPaymentService;
import com.nbh.erp.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import lombok.RequiredArgsConstructor;
@RestController @RequiredArgsConstructor @RequestMapping("/api/v1/supplier-payments")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SUPPLIER_PAYMENT_MANAGE')")
public class SupplierPaymentController {
 private final SupplierPaymentService service;
 @GetMapping public ApiResponse<?> list(){return ApiResponse.ok(service.list());}
 @GetMapping("/outstanding") public ApiResponse<?> outstanding(){return ApiResponse.ok(service.outstanding());}
 public record Pay(@jakarta.validation.constraints.NotNull Long grnId,@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive java.math.BigDecimal amount,String method){}
 @PostMapping public ApiResponse<?> pay(@jakarta.validation.Valid @RequestBody Pay req){return ApiResponse.ok(service.pay(req.grnId(),req.amount(),req.method()));}
 @PostMapping("/{id}/reverse") public ApiResponse<?> reverse(@PathVariable Long id,@RequestBody java.util.Map<String,String> req){return ApiResponse.ok(service.reverse(id,req.get("reason")));}
}
