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

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

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
        if (categoryRepository.existsByCode(request.getCode().trim().toUpperCase())) {
            throw new DuplicateResourceException("Category", "code", request.getCode());
        }

        Category category = Category.builder()
                .code(request.getCode().trim().toUpperCase())
                .name(request.getName().trim())
                .description(request.getDescription())
                .isActive(true)
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

        SecurityUtils.enforceCanEdit("PRODUCT", "Category: " + category.getName());

        categoryRepository.findByCode(request.getCode().trim().toUpperCase())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new DuplicateResourceException("Category", "code", request.getCode());
                    }
                });

        category.setCode(request.getCode().trim().toUpperCase());
        category.setName(request.getName().trim());
        category.setDescription(request.getDescription());

        Category saved = categoryRepository.save(category);

        auditLogService.log("CATEGORY_UPDATE", "INVENTORY", "Category", saved.getCode(),
                String.format("Updated category '%s' (Code: %s)", saved.getName(), saved.getCode()));

        return CategoryDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));

        SecurityUtils.enforceCanEdit("PRODUCT", "Category: " + category.getName());

        category.setIsActive(!category.getIsActive());
        categoryRepository.save(category);

        auditLogService.log("CATEGORY_STATUS", "INVENTORY", "Category", category.getCode(),
                String.format("Set category '%s' active status to %s", category.getName(), category.getIsActive()));
    }

    @Transactional
    public void deleteCategory(Long id) {
        SecurityUtils.enforceNoDelete("Category", id);
    }
}

