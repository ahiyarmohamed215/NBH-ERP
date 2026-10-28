package com.nbh.erp.sales.controller;

import com.nbh.erp.sales.service.*;
import com.nbh.erp.sales.repository.*;
import com.nbh.erp.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController @RequestMapping("/api/v1/invoices/held") @RequiredArgsConstructor
public class HeldWarehouseController {
    private final HeldWarehouseWorkflow workflow;
    private final HeldBillBatchService batches;
    private final HeldOriginalsService originals;
    private final PosStaffPerformanceService performance;

    @GetMapping({"/performance", "/rankings"})
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SALES')")
    public ApiResponse<?> performance(@RequestParam(required=false) String month){return ApiResponse.ok(performance.performance(month));}

    @GetMapping("/originals")
    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead('SALES')")
    public ApiResponse<?> originals(@RequestParam(defaultValue="mine") String scope,@RequestParam(required=false) String query){
        return ApiResponse.ok(originals.workspace(scope,query));
    }

    @PostMapping("/save-split")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SALES_CREATE')")
    public ApiResponse<?> saveSplit(@jakarta.validation.Valid @RequestBody HeldBillBatchService.SaveRequest request) {
        return ApiResponse.ok(batches.save(request));
    }

    @PostMapping("/{id}/send")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SALES_CREATE','SALES_EDIT')")
    public ApiResponse<?> send(@PathVariable Long id,@RequestBody HeldWarehouseWorkflow.SendRequest request){
        return ApiResponse.ok(workflow.send(id,request));
    }

    @GetMapping("/{id}/review-limits")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SALES_EDIT')")
    public ApiResponse<?> reviewLimits(@PathVariable Long id){return ApiResponse.ok(workflow.reviewLimits(id));}

    @PostMapping("/{id}/review")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SALES_EDIT')")
    public ApiResponse<?> review(@PathVariable Long id,@RequestBody HeldWarehouseWorkflow.ReviewRequest request){
        return ApiResponse.ok(workflow.review(id,request));
    }

    @PostMapping("/{id}/print")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','SALES_CREATE','SALES_EDIT')")
    public ApiResponse<?> print(@PathVariable Long id,@RequestParam(required=false) Long warehouseId){
        return ApiResponse.ok(workflow.reprint(id,warehouseId));
    }
}
