package com.nbh.erp.product.service;

import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.brand.repository.BrandRepository;
import com.nbh.erp.category.entity.Category;
import com.nbh.erp.category.repository.CategoryRepository;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;

import com.nbh.erp.product.dto.CreateProductRequest;
import com.nbh.erp.product.dto.ProductDto;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final SupplierRepository supplierRepository;
    private final WarehouseRepository warehouseRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PagedResponse<ProductDto> getProductsPaginated(String query, Long categoryId, Pageable pageable) {
        Page<ProductDto> page = productRepository.searchPaginated(query, categoryId, pageable).map(ProductDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public List<ProductDto> searchActiveProducts(String query) {
        if (!StringUtils.hasText(query)) {
            return productRepository.findByIsActiveTrue().stream().map(ProductDto::from).collect(Collectors.toList());
        }
        return productRepository.searchActiveProducts(query).stream().map(ProductDto::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductDto getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));
        return ProductDto.from(product);
    }

    @Transactional(readOnly = true)
    public ProductDto getProductByBarcode(String barcode) {
        Product product = productRepository.findByBarcode(barcode)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "barcode", barcode));
        return ProductDto.from(product);
    }

    @Transactional
    public ProductDto createProduct(CreateProductRequest request) {
        String sku = request.getSku();
        if (!StringUtils.hasText(sku)) {
            long count = productRepository.count() + 1;
            sku = String.format("PRD-%05d", count);
        } else {
            sku = sku.trim().toUpperCase();
        }

        if (productRepository.existsBySku(sku)) {
            throw new DuplicateResourceException("Product", "SKU", sku);
        }

        if (StringUtils.hasText(request.getBarcode()) && productRepository.existsByBarcode(request.getBarcode().trim())) {
            throw new DuplicateResourceException("Product", "barcode", request.getBarcode());
        }

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));

        Brand brand = null;
        if (request.getBrandId() != null) {
            brand = brandRepository.findById(request.getBrandId())
                    .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", request.getBrandId()));
        }

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));
        }

        Warehouse warehouse = null;
        Long targetWarehouseId = request.getEffectiveWarehouseId();
        if (targetWarehouseId != null) {
            warehouse = warehouseRepository.findById(targetWarehouseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", targetWarehouseId));
        }

        Product product = Product.builder()
                .sku(sku)
                .barcode(StringUtils.hasText(request.getBarcode()) ? request.getBarcode().trim() : null)
                .name(request.getName().trim())
                .description(request.getDescription())
                .category(category)
                .brand(brand)
                .defaultSupplier(supplier)
                .defaultWarehouse(warehouse)
                .unitOfMeasure(StringUtils.hasText(request.getUnitOfMeasure()) ? request.getUnitOfMeasure().trim().toUpperCase() : "PCS")
                .costPrice(request.getCostPrice() != null ? request.getCostPrice() : BigDecimal.ZERO)
                .sellingPrice(request.getSellingPrice() != null ? request.getSellingPrice() : BigDecimal.ZERO)
                .minStockLevel(request.getMinStockLevel() != null ? request.getMinStockLevel() : 5)
                .isActive(true)
                .build();

        Product saved = productRepository.save(product);

        auditLogService.log("PRODUCT_CREATE", "INVENTORY", "Product", saved.getSku(),
                String.format("Created product '%s' (SKU: %s, Selling Price: Rs. %s)", saved.getName(), saved.getSku(), saved.getSellingPrice()));

        return ProductDto.from(saved);
    }

    @Transactional
    public ProductDto updateProduct(Long id, CreateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));

        SecurityUtils.enforceCanEdit("PRODUCT", "Product: " + product.getName());

        if (StringUtils.hasText(request.getSku())) {
            String newSku = request.getSku().trim().toUpperCase();
            productRepository.findBySku(newSku).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Product", "SKU", newSku);
                }
            });
            product.setSku(newSku);
        }

        if (StringUtils.hasText(request.getBarcode())) {
            String newBarcode = request.getBarcode().trim();
            productRepository.findByBarcode(newBarcode).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Product", "barcode", newBarcode);
                }
            });
            product.setBarcode(newBarcode);
        } else {
            product.setBarcode(null);
        }

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));

        Brand brand = null;
        if (request.getBrandId() != null) {
            brand = brandRepository.findById(request.getBrandId())
                    .orElseThrow(() -> new ResourceNotFoundException("Brand", "id", request.getBrandId()));
        }

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));
        }

        Long targetWarehouseId = request.getEffectiveWarehouseId();
        if (targetWarehouseId != null) {
            Warehouse warehouse = warehouseRepository.findById(targetWarehouseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", targetWarehouseId));
            product.setDefaultWarehouse(warehouse);
        }

        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setCategory(category);
        product.setBrand(brand);
        product.setDefaultSupplier(supplier);
        if (StringUtils.hasText(request.getUnitOfMeasure())) {
            product.setUnitOfMeasure(request.getUnitOfMeasure().trim().toUpperCase());
        }
        if (request.getCostPrice() != null) {
            product.setCostPrice(request.getCostPrice());
        }
        if (request.getSellingPrice() != null) {
            product.setSellingPrice(request.getSellingPrice());
        }
        if (request.getMinStockLevel() != null) {
            product.setMinStockLevel(request.getMinStockLevel());
        }

        Product saved = productRepository.save(product);

        auditLogService.log("PRODUCT_UPDATE", "INVENTORY", "Product", saved.getSku(),
                String.format("Updated product '%s' (SKU: %s)", saved.getName(), saved.getSku()));

        return ProductDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));

        SecurityUtils.enforceCanEdit("PRODUCT", "Product: " + product.getName());

        product.setIsActive(!product.getIsActive());
        productRepository.save(product);

        auditLogService.log("PRODUCT_STATUS", "INVENTORY", "Product", product.getSku(),
                String.format("Set product '%s' (SKU: %s) active status to %s", product.getName(), product.getSku(), product.getIsActive()));
    }

    @Transactional
    public void deleteProduct(Long id) {
        SecurityUtils.enforceNoDelete("Product", id);
    }
}
