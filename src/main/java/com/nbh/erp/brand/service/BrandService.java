package com.nbh.erp.brand.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.brand.dto.BrandDto;
import com.nbh.erp.brand.dto.CreateBrandRequest;
import com.nbh.erp.brand.dto.UpdateBrandRequest;
import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.brand.repository.BrandRepository;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrandService {

    private final BrandRepository brandRepository;
    private final AuditLogService auditLogService;

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal()))
                ? auth.getName() : "system";
    }

    @Transactional(readOnly = true)
    public List<BrandDto> getAllBrands() {
        return brandRepository.findAll().stream()
                .map(BrandDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BrandDto> getActiveBrands() {
        return brandRepository.findByIsActiveTrue().stream()
                .map(BrandDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BrandDto> searchBrands(String query) {
        if (!StringUtils.hasText(query)) {
            return getActiveBrands();
        }
        return brandRepository.searchBrands(query).stream()
                .map(BrandDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BrandDto getBrandById(Long id) {
        return brandRepository.findById(id)
                .map(BrandDto::from)
                .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", id));
    }

    @Transactional
    public BrandDto createBrand(CreateBrandRequest request) {
        String cleanCode = request.getCode().trim().toUpperCase();
        if (brandRepository.existsByCode(cleanCode)) {
            throw new DuplicateResourceException("Brand", "code", cleanCode);
        }

        Brand brand = Brand.builder()
                .code(cleanCode)
                .name(request.getName().trim())
                .description(request.getDescription())
                .isActive(true)
                .build();

        Brand saved = brandRepository.save(brand);
        log.info("Brand created: {} ({}) by {}", saved.getName(), saved.getCode(), getCurrentUsername());
        auditLogService.log("BRAND_CREATE", "Brand", saved.getCode(),
                String.format("Brand '%s' created by %s", saved.getName(), getCurrentUsername()));

        return BrandDto.from(saved);
    }

    @Transactional
    public BrandDto updateBrand(Long id, UpdateBrandRequest request) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", id));

        SecurityUtils.enforceCanEdit("PRODUCT", "Brand: " + brand.getName());

        brand.setName(request.getName().trim());
        brand.setDescription(request.getDescription());

        Brand saved = brandRepository.save(brand);
        log.info("Brand ID {} updated: {} by {}", id, saved.getName(), getCurrentUsername());
        auditLogService.log("BRAND_UPDATE", "Brand", saved.getCode(),
                String.format("Brand '%s' updated by %s", saved.getName(), getCurrentUsername()));

        return BrandDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", id));

        SecurityUtils.enforceCanEdit("PRODUCT", "Brand: " + brand.getName());

        brand.setIsActive(!brand.getIsActive());
        brandRepository.save(brand);
        log.info("Brand ID {} active status toggled to {}", id, brand.getIsActive());
        auditLogService.log("BRAND_TOGGLE", "Brand", brand.getCode(),
                String.format("Brand '%s' active status set to %s by %s", brand.getName(), brand.getIsActive(), getCurrentUsername()));
    }

    @Transactional
    public void deleteBrand(Long id) {
        SecurityUtils.enforceNoDelete("Brand", id);
    }
}
