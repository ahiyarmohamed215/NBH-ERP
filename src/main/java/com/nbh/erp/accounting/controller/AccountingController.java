package com.nbh.erp.accounting.controller;
import com.nbh.erp.accounting.service.AccountingService;
import com.nbh.erp.accounting.service.AccountingService.*;
import com.nbh.erp.common.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Pageable;
import java.util.*;
import java.time.LocalDate;
@RestController @RequestMapping("/api/v1/accounting") @RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_VIEW')")
public class AccountingController {
 private final AccountingService service;
 @GetMapping("/accounts") public ApiResponse<List<AccountView>> accounts() { return ApiResponse.ok(service.accounts()); }
 @PostMapping("/accounts") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_MANAGE')")
 public ApiResponse<AccountView> create(@RequestBody AccountView request) { return ApiResponse.ok(service.createAccount(request)); }
 @GetMapping("/journals") public ApiResponse<PagedResponse<Entry>> journals(@RequestParam(required=false) String kind,Pageable page) { return ApiResponse.ok(service.list(kind,page)); }
 @PostMapping("/journals") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_MANAGE')")
 public ApiResponse<Entry> post(@RequestBody Posting request) {
  if(request.source()==null || !request.source().startsWith("MANUAL-")) throw new com.nbh.erp.common.exception.BusinessException("Manual source must start with MANUAL-");
  return ApiResponse.ok(service.post(request));
 }
 @PostMapping("/journals/{id}/reverse") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_MANAGE')")
 public ApiResponse<Entry> reverse(@PathVariable Long id,@RequestBody Map<String,String> request) { return ApiResponse.ok(service.reverseManual(id,request.get("reason"))); }
 @PostMapping("/journals/{id}/reconcile") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_MANAGE')")
 public ApiResponse<Entry> reconcile(@PathVariable Long id) { return ApiResponse.ok(service.reconcile(id)); }
 @PostMapping("/years/{year}/close") @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ACCOUNTING_MANAGE')")
 public ApiResponse<Void> close(@PathVariable Integer year) { service.closeYear(year); return ApiResponse.ok("Year closed",null); }
 @GetMapping("/trial-balance") public ApiResponse<List<Balance>> trial(@RequestParam(required=false) LocalDate startDate,@RequestParam(required=false) LocalDate endDate) { return ApiResponse.ok(service.trialBalance(startDate,endDate)); }
 @GetMapping("/income-statement") public ApiResponse<List<Balance>> income(@RequestParam(required=false) LocalDate startDate,@RequestParam(required=false) LocalDate endDate) { return ApiResponse.ok(service.trialBalance(startDate,endDate).stream().filter(b -> Set.of("INCOME","EXPENSE").contains(b.type())).toList()); }
 @GetMapping("/balance-sheet") public ApiResponse<List<Balance>> balance(@RequestParam(required=false) LocalDate endDate) { return ApiResponse.ok(service.balanceSheet(endDate)); }
}
