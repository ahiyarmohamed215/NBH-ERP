package com.nbh.erp;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.product.dto.CreateProductRequest;
import com.nbh.erp.product.service.ProductService;
import com.nbh.erp.brand.dto.*;
import com.nbh.erp.brand.service.BrandService;
import com.nbh.erp.category.dto.CreateCategoryRequest;
import com.nbh.erp.category.service.CategoryService;
import com.nbh.erp.warehouse.dto.CreateWarehouseRequest;
import com.nbh.erp.warehouse.service.WarehouseService;
import com.nbh.erp.recyclebin.RecycleBinService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class MasterRecordLifecycleTest {
    @Autowired ProductService products;
    @Autowired BrandService brands;
    @Autowired CategoryService categories;
    @Autowired WarehouseService warehouses;
    @Autowired RecycleBinService bin;
    @Autowired EntityManager em;

    @BeforeEach void auth() { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("master-test", "unused", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))); }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    Long draft(String type) {
        return switch(type) {
            case "PRODUCT" -> { var r=new CreateProductRequest();r.setStatus("DRAFT");r.setDescription("Complete tomorrow");yield products.createProduct(r).getId(); }
            case "BRAND" -> { var r=CreateBrandRequest.builder().status("DRAFT").description("Complete tomorrow").build();yield brands.createBrand(r).getId(); }
            case "CATEGORY" -> { var r=new CreateCategoryRequest();r.setStatus("DRAFT");r.setDescription("Complete tomorrow");yield categories.createCategory(r).getId(); }
            default -> { var r=new CreateWarehouseRequest();r.setStatus("DRAFT");r.setAddress("Complete tomorrow");yield warehouses.createWarehouse(r).getId(); }
        };
    }
    String status(String type, Long id) { return switch(type) {case "PRODUCT" -> products.getProductById(id).getStatus();case "BRAND" -> brands.getBrandById(id).getStatus();case "CATEGORY" -> categories.getCategoryById(id).getStatus();default -> warehouses.getWarehouseById(id).getStatus();}; }
    void transition(String type, Long id, String target, String reason) { switch(type) {case "PRODUCT" -> products.changeStatus(id,target,reason);case "BRAND" -> brands.changeStatus(id,target,reason);case "CATEGORY" -> categories.changeStatus(id,target,reason);default -> warehouses.changeStatus(id,target,reason);} }
    void complete(String type, Long id) {
        switch(type) {
            case "PRODUCT" -> {var c=new CreateCategoryRequest();c.setName("Category for activation");c.setCode("ACT-CAT");var category=categories.createCategory(c);var r=new CreateProductRequest();r.setName("Completed product");r.setCategoryId(category.getId());products.updateProduct(id,r);}
            case "BRAND" -> brands.updateBrand(id,UpdateBrandRequest.builder().name("Completed brand").build());
            case "CATEGORY" -> {var r=new CreateCategoryRequest();r.setName("Completed category");categories.updateCategory(id,r);}
            default -> {var r=new CreateWarehouseRequest();r.setName("Completed warehouse");warehouses.updateWarehouse(id,r);}
        }
    }
    @ParameterizedTest @ValueSource(strings={"PRODUCT","BRAND","CATEGORY","WAREHOUSE"})
    void partialDraftMustBeCompletedAndReasonIsRequiredForEveryTransition(String type) {
        Long id=draft(type);em.flush();assertEquals("DRAFT",status(type,id));
        assertThrows(BusinessException.class,()->transition(type,id,"ACTIVE",""));
        assertThrows(BusinessException.class,()->transition(type,id,"ACTIVE","Approved"));
        assertEquals("DRAFT",status(type,id));
        complete(type,id);assertEquals("DRAFT",status(type,id));
        transition(type,id,"ACTIVE","Details verified");assertEquals("ACTIVE",status(type,id));
        transition(type,id,"INACTIVE","Temporarily paused");assertEquals("INACTIVE",status(type,id));
        transition(type,id,"ACTIVE","Resume use");assertEquals("ACTIVE",status(type,id));
        transition(type,id,"DRAFT","Needs review");assertEquals("DRAFT",status(type,id));em.flush();
    }
    @ParameterizedTest @ValueSource(strings={"BRAND","CATEGORY","WAREHOUSE"})
    void recycledDraftRestoresAsDraftAndDeletedRecordCannotBeActivated(String type) {
        Long id=draft(type);bin.delete(type,id);em.flush();
        assertThrows(BusinessException.class,()->transition(type,id,"ACTIVE","Approved"));
        bin.restore(type,id);em.flush();assertEquals("DRAFT",status(type,id));
        complete(type,id);transition(type,id,"ACTIVE","Approved");bin.delete(type,id);bin.restore(type,id);assertEquals("ACTIVE",status(type,id));
    }
    @Test void emptyDraftsAreRejected() {
        var p=new CreateProductRequest();p.setStatus("DRAFT");assertThrows(BusinessException.class,()->products.createProduct(p));
        assertThrows(BusinessException.class,()->brands.createBrand(CreateBrandRequest.builder().status("DRAFT").build()));
        var c=new CreateCategoryRequest();c.setStatus("DRAFT");assertThrows(BusinessException.class,()->categories.createCategory(c));
        var w=new CreateWarehouseRequest();w.setStatus("DRAFT");assertThrows(BusinessException.class,()->warehouses.createWarehouse(w));
    }
}
