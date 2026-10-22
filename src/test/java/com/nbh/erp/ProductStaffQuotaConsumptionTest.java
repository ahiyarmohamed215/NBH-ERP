package com.nbh.erp;
import com.nbh.erp.inventory.service.*;
import com.nbh.erp.inventory.repository.*;
import com.nbh.erp.inventory.entity.ProductStaffQuota;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ProductStaffQuotaConsumptionTest {
 final ProductStaffQuotaRepository repository=mock(ProductStaffQuotaRepository.class);
 final ProductStaffQuotaService service=new ProductStaffQuotaService(repository,mock(ProductRepository.class),mock(UserRepository.class),mock(WarehouseRepository.class),mock(StockService.class),mock(StockBalanceRepository.class),mock(AuditLogService.class));
 void quotas(List<ProductStaffQuota> rows){when(repository.findMatchingActiveQuotas(1L,2L,3L)).thenReturn(rows);when(repository.lockMatchingActiveQuotas(1L,2L,3L)).thenReturn(rows);}
 @Test void noAllocationIsUnrestricted(){quotas(List.of());assertDoesNotThrow(()->service.consumeStaffQuota(1L,2L,3L,BigDecimal.TEN));verify(repository,never()).save(any());}
 @Test void effectiveAllocationIsConsumedAndRealLimitStillApplies(){var quota=ProductStaffQuota.builder().allocatedQuantity(BigDecimal.TEN).soldQuantity(BigDecimal.ZERO).build();quotas(List.of(quota));service.consumeStaffQuota(1L,2L,3L,BigDecimal.valueOf(4));assertEquals(0,BigDecimal.valueOf(4).compareTo(quota.getSoldQuantity()));assertThrows(BusinessException.class,()->service.consumeStaffQuota(1L,2L,3L,BigDecimal.TEN));}
 @Test void futureAllocationIsNotConsumed(){var quota=ProductStaffQuota.builder().allocatedQuantity(BigDecimal.TEN).validFrom(LocalDate.now().plusDays(1)).build();quotas(List.of(quota));assertDoesNotThrow(()->service.consumeStaffQuota(1L,2L,3L,BigDecimal.TEN));assertEquals(0,quota.getSoldQuantity().signum());verify(repository,never()).save(any());}
 @Test void heldInvoiceRecordsSaleWithoutRevalidatingReducedAllocation(){var quota=ProductStaffQuota.builder().allocatedQuantity(BigDecimal.valueOf(2)).soldQuantity(BigDecimal.ZERO).build();quotas(List.of(quota));assertDoesNotThrow(()->service.recordHeldStaffQuota(1L,2L,3L,BigDecimal.valueOf(5)));assertEquals(0,BigDecimal.valueOf(5).compareTo(quota.getSoldQuantity()));assertEquals(0,quota.getRemainingQuantity().signum());verify(repository,never()).findMatchingActiveQuotas(any(),any(),any());}
 @Test void heldInvoiceWithNoEffectiveAllocationDoesNotBlock(){quotas(List.of());assertDoesNotThrow(()->service.recordHeldStaffQuota(1L,2L,3L,BigDecimal.TEN));verify(repository,never()).save(any());}
}
