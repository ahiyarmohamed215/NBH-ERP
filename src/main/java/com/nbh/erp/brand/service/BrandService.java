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
import com.nbh.erp.security.SecurityUtils;

import com.nbh.erp.common.validation.MasterRecordLifecycle;
import com.nbh.erp.common.dto.StatusChangeRequest;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrandService {
    @org.springframework.beans.factory.annotation.Autowired private com.nbh.erp.recyclebin.RecycleBinService recycleBin;

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
        String status = MasterRecordLifecycle.initialStatus(request.getStatus());
        MasterRecordLifecycle.validate("Brand", status, request.getName(), request.getDescription(), request.getCode());
        request.setCode(MasterRecordLifecycle.code(request.getCode(), "BR", brandRepository.count(), brandRepository::existsByCode));
        String cleanCode = request.getCode().trim().toUpperCase();
        if (brandRepository.existsByCode(cleanCode)) {
            throw new DuplicateResourceException("Brand", "code", cleanCode);
        }

        Brand brand = Brand.builder()
                .code(cleanCode)
                .name(MasterRecordLifecycle.clean(request.getName()))
                .description(request.getDescription())
                .markupPercent(request.getMarkupPercent() != null ? request.getMarkupPercent() : java.math.BigDecimal.ZERO)
                .isActive("ACTIVE".equals(status))
                .status(status)
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

        SecurityUtils.enforceCanEdit("BRAND", "Brand: " + brand.getName());
        brand.requireNotDeleted();
        MasterRecordLifecycle.validate("Brand", brand.getStatus(), request.getName(), request.getDescription(), brand.getCode());

        brand.setName(MasterRecordLifecycle.clean(request.getName()));
        brand.setDescription(request.getDescription());
        if (request.getMarkupPercent() != null) brand.setMarkupPercent(request.getMarkupPercent());

        Brand saved = brandRepository.save(brand);
        log.info("Brand ID {} updated: {} by {}", id, saved.getName(), getCurrentUsername());
        auditLogService.log("BRAND_UPDATE", "Brand", saved.getCode(),
                String.format("Brand '%s' updated by %s", saved.getName(), getCurrentUsername()));

        return BrandDto.from(saved);
    }

    @Transactional
    public BrandDto changeStatus(Long id, String target, String reason) {
        target = MasterRecordLifecycle.targetStatus(target);
        reason = StatusChangeRequest.requireReason(reason);
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", id));
        SecurityUtils.enforceCanEdit("BRAND", "Brand: " + brand.getCode());
        brand.requireNotDeleted();
        MasterRecordLifecycle.validate("Brand", target, brand.getName(), brand.getCode());
        String previous = brand.getStatus();
        brand.setStatus(target);
        brand.setIsActive("ACTIVE".equals(target));
        Brand saved = brandRepository.save(brand);
        auditLogService.log("BRAND_STATUS", "INVENTORY", "Brand", brand.getCode(), previous + " -> " + target + ": " + reason);
        return BrandDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Brand record = brandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", id));
        changeStatus(id, "ACTIVE".equals(record.getStatus()) ? "INACTIVE" : "ACTIVE", "Changed from legacy status control");
    }

    @Transactional
    public void deleteBrand(Long id) {
        recycleBin.delete("BRAND", id);
    }
}
