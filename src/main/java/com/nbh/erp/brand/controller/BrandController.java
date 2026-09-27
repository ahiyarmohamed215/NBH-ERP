package com.nbh.erp.brand.controller;

import com.nbh.erp.brand.dto.BrandDto;
import com.nbh.erp.brand.dto.CreateBrandRequest;
import com.nbh.erp.brand.dto.UpdateBrandRequest;
import com.nbh.erp.brand.service.BrandService;
import com.nbh.erp.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/brands")
@RequiredArgsConstructor
@Tag(name = "Brand Management", description = "Product brand master APIs")
public class BrandController {

    private final BrandService brandService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_VIEW') or hasAuthority('PRODUCT_VIEW')")
    @Operation(summary = "List all brands")
    public ResponseEntity<ApiResponse<List<BrandDto>>> getAllBrands() {
        return ResponseEntity.ok(ApiResponse.ok(brandService.getAllBrands()));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_VIEW') or hasAuthority('PRODUCT_VIEW')")
    @Operation(summary = "List active brands for selection dropdowns")
    public ResponseEntity<ApiResponse<List<BrandDto>>> getActiveBrands() {
        return ResponseEntity.ok(ApiResponse.ok(brandService.getActiveBrands()));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_VIEW') or hasAuthority('PRODUCT_VIEW')")
    @Operation(summary = "Search brands by name or code")
    public ResponseEntity<ApiResponse<List<BrandDto>>> searchBrands(@RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(ApiResponse.ok(brandService.searchBrands(query)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_VIEW') or hasAuthority('PRODUCT_VIEW')")
    @Operation(summary = "Get brand by ID")
    public ResponseEntity<ApiResponse<BrandDto>> getBrandById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(brandService.getBrandById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_MANAGE') or hasAuthority('PRODUCT_MANAGE')")
    @Operation(summary = "Create a new brand")
    public ResponseEntity<ApiResponse<BrandDto>> createBrand(@Valid @RequestBody CreateBrandRequest request) {
        BrandDto created = brandService.createBrand(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Brand created successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_MANAGE') or hasAuthority('PRODUCT_MANAGE')")
    @Operation(summary = "Update brand details")
    public ResponseEntity<ApiResponse<BrandDto>> updateBrand(
            @PathVariable Long id,
            @Valid @RequestBody UpdateBrandRequest request
    ) {
        BrandDto updated = brandService.updateBrand(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Brand updated successfully", updated));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_MANAGE') or hasAuthority('PRODUCT_MANAGE')")
    @Operation(summary = "Toggle brand active status")
    public ResponseEntity<ApiResponse<Void>> toggleActive(@PathVariable Long id) {
        brandService.toggleActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Brand status updated", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('BRAND_MANAGE') or hasAuthority('PRODUCT_MANAGE')")
    @Operation(summary = "Soft-delete a brand")
    public ResponseEntity<Void> deleteBrand(@PathVariable Long id) {
        brandService.deleteBrand(id);
        return ResponseEntity.noContent().build();
    }
}
