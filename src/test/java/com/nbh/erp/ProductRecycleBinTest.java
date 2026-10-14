package com.nbh.erp;

import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.product.service.ProductService;
import com.nbh.erp.recyclebin.RecycleBinService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class ProductRecycleBinTest {
 @Autowired EntityManager em;
 @Autowired ProductRepository products;
 @Autowired ProductService service;
 @Autowired RecycleBinService bin;
 @BeforeEach void auth(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("product-manager","unused",List.of(new SimpleGrantedAuthority("PRODUCT_MANAGE"))));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @ParameterizedTest @ValueSource(strings={"DRAFT","ACTIVE","INACTIVE"})
 void productDeletionRestoresStatusAndPermanentDeletionPreservesLinkedStock(String status){
  var warehouse=Warehouse.builder().code("PRODUCT-BIN-WH").name("Warehouse").build();em.persist(warehouse);
  var product=Product.builder().sku("PRODUCT-BIN-"+status).barcode("BIN-BARCODE").name("Historical product").description("Remove on purge").status(status).isActive("ACTIVE".equals(status)).build();em.persist(product);
  var stock=StockBalance.builder().product(product).warehouse(warehouse).quantity(BigDecimal.TEN).build();em.persist(stock);
  var allocation=ProductStaffQuota.builder().product(product).allocationStatus("DRAFT").isActive(false).allocatedQuantity(BigDecimal.ONE).soldQuantity(BigDecimal.ZERO).build();em.persist(allocation);em.flush();
  service.deleteProduct(product.getId());em.flush();
  assertTrue(product.isDeleted());assertFalse(product.getIsActive());
  assertTrue(products.searchPaginated(null,null,PageRequest.of(0,100)).stream().noneMatch(p->p.getId().equals(product.getId())));
  assertTrue(bin.list().stream().anyMatch(p->p.type().equals("PRODUCT") && p.code().equals(product.getSku())));
  assertThrows(BusinessException.class,()->service.changeStatus(product.getId(),"ACTIVE","Try activation"));
  assertThrows(com.nbh.erp.common.exception.ResourceNotFoundException.class,()->service.getProductByBarcode("BIN-BARCODE"));
  bin.restore("PRODUCT",product.getId());assertEquals(status,product.getStatus());assertEquals("ACTIVE".equals(status),product.getIsActive());em.flush();
  assertTrue(products.searchPaginated(null,null,PageRequest.of(0,100)).stream().anyMatch(p->p.getId().equals(product.getId())));
  bin.delete("PRODUCT",product.getId());bin.purge("PRODUCT",product.getId());em.flush();em.clear();
  assertThrows(BusinessException.class,()->bin.restore("PRODUCT",product.getId()));
  assertTrue(bin.list().stream().noneMatch(p->p.type().equals("PRODUCT") && p.id().equals(product.getId())));
  assertEquals("Historical product",em.find(ProductStaffQuota.class,allocation.getId()).getProduct().getName());
  assertEquals(0,em.find(StockBalance.class,stock.getId()).getQuantity().compareTo(BigDecimal.TEN));
  assertNull(em.find(Product.class,product.getId()).getDescription());
 }
 @Test void productBinRequiresProductManagePermission(){
  var p=Product.builder().sku("BIN-PERMISSION").name("Restricted product").build();em.persist(p);em.flush();
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("viewer","unused",List.of(new SimpleGrantedAuthority("PRODUCT_VIEW"))));
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->bin.delete("PRODUCT",p.getId()));assertFalse(p.isDeleted());
 }
}
