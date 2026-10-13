package com.nbh.erp.purchaseorder.controller;
import com.nbh.erp.purchaseorder.service.PurchaseOrderService;
import com.nbh.erp.purchaseorder.dto.*;
import com.nbh.erp.common.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Pageable;
import jakarta.validation.Valid;
@RestController @RequestMapping("/api/v1/purchase-orders") @RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SUPPLIER_MANAGE')")
public class PurchaseOrderController {
 private final PurchaseOrderService service;
 @GetMapping public ApiResponse<PagedResponse<PurchaseOrderDto>> list(@RequestParam(required=false) String status,@RequestParam(required=false) String query,@org.springframework.data.web.PageableDefault(size=20,sort={"createdAt","id"},direction=org.springframework.data.domain.Sort.Direction.DESC) Pageable page) { return ApiResponse.ok(service.search(status,query,page)); }
 @GetMapping("/{id}") public ApiResponse<PurchaseOrderDto> get(@PathVariable Long id) { return ApiResponse.ok(service.get(id)); }
 @PostMapping public ApiResponse<PurchaseOrderDto> create(@Valid @RequestBody PurchaseOrderRequest req) { return ApiResponse.ok(service.save(null,req)); }
 @PutMapping("/{id}") public ApiResponse<PurchaseOrderDto> update(@PathVariable Long id,@Valid @RequestBody PurchaseOrderRequest req) { return ApiResponse.ok(service.save(id,req)); }
 @PostMapping("/{id}/status") public ApiResponse<PurchaseOrderDto> changeStatus(@PathVariable Long id,@Valid @RequestBody PurchaseOrderStatusRequest request) { return ApiResponse.ok(service.transition(id,request.status(),request.reason())); }
}
