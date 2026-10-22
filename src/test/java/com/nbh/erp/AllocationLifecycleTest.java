package com.nbh.erp;
import com.nbh.erp.inventory.service.*;
import com.nbh.erp.inventory.repository.*;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.inventory.dto.*;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AllocationLifecycleTest {
 final ProductStaffQuotaRepository quotas=mock(ProductStaffQuotaRepository.class);
 final ProductRepository products=mock(ProductRepository.class);
 final UserRepository users=mock(UserRepository.class);
 final StockService stock=mock(StockService.class);
 final StockBalanceRepository balances=mock(StockBalanceRepository.class);
 final AuditLogService audit=mock(AuditLogService.class);
 final ProductStaffQuotaService service=new ProductStaffQuotaService(quotas,products,users,mock(WarehouseRepository.class),stock,balances,audit);
 final Warehouse warehouse=Warehouse.builder().id(10L).build();
 final Product product=Product.builder().id(1L).name("Product").defaultWarehouse(warehouse).build();
 final User user=User.builder().id(7L).username("cashier").build();
 ProductStaffQuota quota(String status){var quota=ProductStaffQuota.builder().id(42L).product(product).user(user).warehouse(warehouse).allocatedQuantity(new BigDecimal("10")).soldQuantity(BigDecimal.ZERO).isActive("ACTIVE".equals(status)).allocationStatus(status).build();when(quotas.findByIdForUpdate(42L)).thenReturn(Optional.of(quota));when(quotas.save(any())).thenAnswer(call->call.getArgument(0));return quota;}
 UpdateProductStaffQuotaRequest transition(String status,String reason){return UpdateProductStaffQuotaRequest.builder().status(status).statusReason(reason).build();}
 @Test void draftCanBeSavedWithoutStockAndDoesNotActivateSellingLimit(){
  when(products.findById(1L)).thenReturn(Optional.of(product));when(users.findById(7L)).thenReturn(Optional.of(user));when(stock.getAvailableStock(10L,1L)).thenReturn(BigDecimal.ZERO);when(quotas.save(any())).thenAnswer(call->{ProductStaffQuota q=call.getArgument(0);q.setId(42L);return q;});
  var request=CreateProductStaffQuotaRequest.builder().productId(1L).userId(7L).allocatedQuantity(new BigDecimal("10")).status("DRAFT").build();
  var dto=service.createOrUpdateQuota(request);assertEquals("DRAFT",dto.getStatus());assertFalse(dto.getIsActive());
 }
 @Test void activationChecksStockAndRequiresReason(){
  var q=quota("DRAFT");when(stock.getAvailableStock(10L,1L)).thenReturn(new BigDecimal("2"));
  assertThrows(BusinessException.class,()->service.updateQuota(42L,transition("ACTIVE","")));
  assertThrows(BusinessException.class,()->service.updateQuota(42L,transition("ACTIVE","Approved allocation")));assertFalse(q.getIsActive());
  when(stock.getAvailableStock(10L,1L)).thenReturn(new BigDecimal("20"));assertEquals("ACTIVE",service.updateQuota(42L,transition("ACTIVE","Approved allocation")).getStatus());assertTrue(q.getIsActive());
 }
 @Test void deactivationPreservesSalesAndRequiresAReason(){
  var q=quota("ACTIVE");q.setSoldQuantity(new BigDecimal("3"));
  assertThrows(BusinessException.class,()->service.updateQuota(42L,transition("INACTIVE","")));
  var dto=service.updateQuota(42L,transition("INACTIVE","Staff allocation paused"));assertEquals("INACTIVE",dto.getStatus());assertFalse(dto.getIsActive());assertEquals(new BigDecimal("3"),dto.getSoldQuantity());
  verify(stock,never()).decreaseStock(anyLong(),anyLong(),any(),anyString(),anyString(),anyString());
  assertEquals("INACTIVE",service.updateQuota(42L,UpdateProductStaffQuotaRequest.builder().allocatedQuantity(new BigDecimal("12")).build()).getStatus());
  verify(audit).log(eq("ALLOCATION_STATUS"),eq("ProductStaffQuota"),eq("42"),contains("Staff allocation paused"));
 }
 @Test void staffCanHaveMultipleAllocations(){
  var q=quota("ACTIVE");when(products.findById(1L)).thenReturn(Optional.of(product));when(users.findById(7L)).thenReturn(Optional.of(user));
  when(quotas.save(any())).thenAnswer(call->{ProductStaffQuota saved=call.getArgument(0);saved.setId(99L);return saved;});
  var dto=service.createOrUpdateQuota(CreateProductStaffQuotaRequest.builder().productId(1L).userId(7L).allocatedQuantity(BigDecimal.ONE).status("DRAFT").build());
  assertEquals("DRAFT",dto.getStatus());assertEquals(99L,dto.getId());assertTrue(q.getIsActive());
 }
 @Test void notesOnlyDraftCanBeSavedAndMustBeCompletedBeforeActivation(){
  when(quotas.save(any())).thenAnswer(call->{ProductStaffQuota q=call.getArgument(0);q.setId(43L);return q;});
  var dto=service.createOrUpdateQuota(CreateProductStaffQuotaRequest.builder().notes("Complete tomorrow").status("DRAFT").build());
  assertEquals("DRAFT",dto.getStatus());assertNull(dto.getProductId());assertNull(dto.getUserId());assertNull(dto.getAllocatedQuantity());assertFalse(dto.getIsActive());
  var partial=ProductStaffQuota.builder().id(43L).notes("Complete tomorrow").allocatedQuantity(null).soldQuantity(BigDecimal.ZERO).allocationStatus("DRAFT").isActive(false).build();
  when(quotas.findByIdForUpdate(43L)).thenReturn(Optional.of(partial));
  assertThrows(BusinessException.class,()->service.updateQuota(43L,transition("ACTIVE","Approved")));
  when(products.findById(1L)).thenReturn(Optional.of(product));when(users.findById(7L)).thenReturn(Optional.of(user));
  var completed=service.updateQuota(43L,UpdateProductStaffQuotaRequest.builder().productId(1L).userId(7L).allocatedQuantity(new BigDecimal("4")).status("DRAFT").build());
  assertEquals(1L,completed.getProductId());assertEquals(7L,completed.getUserId());assertEquals("DRAFT",completed.getStatus());
  when(stock.getAvailableStock(10L,1L)).thenReturn(new BigDecimal("18"));
  assertEquals("ACTIVE",service.updateQuota(43L,transition("ACTIVE","Details verified")).getStatus());
 }
 @Test void completelyEmptyDraftIsRejected(){
  assertThrows(BusinessException.class,()->service.createOrUpdateQuota(CreateProductStaffQuotaRequest.builder().status("DRAFT").build()));
 }
 @Test void exhaustedLimitStillHasActiveLifecycleStatus(){
  var q=quota("ACTIVE");q.setSoldQuantity(q.getAllocatedQuantity());
  assertEquals("ACTIVE",ProductStaffQuotaDto.fromEntity(q,BigDecimal.ZERO).getStatus());
 }
 @Test void draftEditingCanClearPreviouslyEnteredFields(){
  var q=quota("DRAFT");q.setNotes("Keep for tomorrow");
  var dto=service.updateQuota(42L,UpdateProductStaffQuotaRequest.builder().status("DRAFT").replaceDraftFields(true).notes("Keep for tomorrow").build());
  assertNull(dto.getProductId());assertNull(dto.getUserId());assertNull(dto.getAllocatedQuantity());assertEquals("DRAFT",dto.getStatus());
 }
 @Test void multipleActiveAllocationsAggregateLimitsAndConsumeSequentially(){
  var q1=ProductStaffQuota.builder().id(101L).product(product).user(user).warehouse(warehouse).allocatedQuantity(new BigDecimal("5")).soldQuantity(BigDecimal.ZERO).isActive(true).allocationStatus("ACTIVE").build();
  var q2=ProductStaffQuota.builder().id(102L).product(product).user(user).warehouse(warehouse).allocatedQuantity(new BigDecimal("10")).soldQuantity(BigDecimal.ZERO).isActive(true).allocationStatus("ACTIVE").build();
  when(quotas.findMatchingActiveQuotas(1L,7L,10L)).thenReturn(java.util.List.of(q1,q2));
  when(quotas.lockMatchingActiveQuotas(1L,7L,10L)).thenReturn(java.util.List.of(q1,q2));

  var check=service.checkStaffProductQuota(1L,7L,10L,new BigDecimal("12"));
  assertTrue(check.isAllowed());
  assertEquals(new BigDecimal("15"),check.getAllocatedQuantity());
  assertEquals(new BigDecimal("15"),check.getRemainingQuantity());

  service.consumeStaffQuota(1L,7L,10L,new BigDecimal("8"));
  assertEquals(new BigDecimal("5"),q1.getSoldQuantity());
  assertEquals(new BigDecimal("3"),q2.getSoldQuantity());

  var check2=service.checkStaffProductQuota(1L,7L,10L,new BigDecimal("7"));
  assertTrue(check2.isAllowed());
  assertEquals(new BigDecimal("7"),check2.getRemainingQuantity());

  assertThrows(BusinessException.class,()->service.consumeStaffQuota(1L,7L,10L,new BigDecimal("8")));
 }
}
