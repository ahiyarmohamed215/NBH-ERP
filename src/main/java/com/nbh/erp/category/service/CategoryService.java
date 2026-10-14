package com.nbh.erp.category.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.category.dto.CategoryDto;
import com.nbh.erp.category.dto.CreateCategoryRequest;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nbh.erp.common.validation.MasterRecordLifecycle;
import com.nbh.erp.common.dto.StatusChangeRequest;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {
    @org.springframework.beans.factory.annotation.Autowired private com.nbh.erp.recyclebin.RecycleBinService recycleBin;

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<CategoryDto> getAllCategories() {
        return categoryRepository.findAll().stream()
                .map(CategoryDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> getActiveCategories() {
        return categoryRepository.findByIsActiveTrue().stream()
                .map(CategoryDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CategoryDto getCategoryById(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        return CategoryDto.from(category);
    }

    @Transactional
    public CategoryDto createCategory(CreateCategoryRequest request) {
        String status = MasterRecordLifecycle.initialStatus(request.getStatus());
        MasterRecordLifecycle.validate("Category", status, request.getName(), request.getDescription(), request.getCode());
        request.setCode(MasterRecordLifecycle.code(request.getCode(), "CAT", categoryRepository.count(), categoryRepository::existsByCode));
        if (categoryRepository.existsByCode(request.getCode().trim().toUpperCase())) {
            throw new DuplicateResourceException("Category", "code", request.getCode());
        }

        Category category = Category.builder()
                .code(request.getCode().trim().toUpperCase())
                .name(MasterRecordLifecycle.clean(request.getName()))
                .description(request.getDescription())
                .isActive("ACTIVE".equals(status))
                .status(status)
                .build();

        Category saved = categoryRepository.save(category);

        auditLogService.log("CATEGORY_CREATE", "INVENTORY", "Category", saved.getCode(),
                String.format("Created category '%s' (Code: %s)", saved.getName(), saved.getCode()));

        return CategoryDto.from(saved);
    }

    @Transactional
    public CategoryDto updateCategory(Long id, CreateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));

        SecurityUtils.enforceCanEdit("CATEGORY", "Category: " + category.getName());
        category.requireNotDeleted();
        MasterRecordLifecycle.validate("Category", category.getStatus(), request.getName(), request.getDescription(), request.getCode());

        request.setCode(org.springframework.util.StringUtils.hasText(request.getCode()) ? request.getCode().trim().toUpperCase() : category.getCode());

        categoryRepository.findByCode(request.getCode().trim().toUpperCase())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new DuplicateResourceException("Category", "code", request.getCode());
                    }
                });

        category.setCode(request.getCode().trim().toUpperCase());
        category.setName(MasterRecordLifecycle.clean(request.getName()));
        category.setDescription(request.getDescription());

        Category saved = categoryRepository.save(category);

        auditLogService.log("CATEGORY_UPDATE", "INVENTORY", "Category", saved.getCode(),
                String.format("Updated category '%s' (Code: %s)", saved.getName(), saved.getCode()));

        return CategoryDto.from(saved);
    }

    @Transactional
    public CategoryDto changeStatus(Long id, String target, String reason) {
        target = MasterRecordLifecycle.targetStatus(target);
        reason = StatusChangeRequest.requireReason(reason);
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        SecurityUtils.enforceCanEdit("CATEGORY", "Category: " + category.getCode());
        category.requireNotDeleted();
        MasterRecordLifecycle.validate("Category", target, category.getName(), category.getCode());
        String previous = category.getStatus();
        category.setStatus(target);
        category.setIsActive("ACTIVE".equals(target));
        Category saved = categoryRepository.save(category);
        auditLogService.log("CATEGORY_STATUS", "INVENTORY", "Category", category.getCode(), previous + " -> " + target + ": " + reason);
        return CategoryDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Category record = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        changeStatus(id, "ACTIVE".equals(record.getStatus()) ? "INACTIVE" : "ACTIVE", "Changed from legacy status control");
    }

    @Transactional
    public void deleteCategory(Long id) {
        recycleBin.delete("CATEGORY", id);
    }
}

