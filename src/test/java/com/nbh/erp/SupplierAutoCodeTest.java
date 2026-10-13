package com.nbh.erp;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.supplier.dto.CreateSupplierRequest;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.supplier.service.SupplierService;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SupplierAutoCodeTest {
    @Test void automaticCodeSkipsExistingCodesAndIgnoresManualInput() {
        var repository=mock(SupplierRepository.class);
        var validator=mock(Validator.class);
        when(validator.validate(any(CreateSupplierRequest.class))).thenReturn(java.util.Set.of());
        when(repository.count()).thenReturn(2L);
        when(repository.existsBySupplierCode("SUPP-0003")).thenReturn(true);
        when(repository.save(any(Supplier.class))).thenAnswer(invocation->{Supplier supplier=invocation.getArgument(0);supplier.setId(8L);return supplier;});
        var service=new SupplierService(validator,repository,mock(GrnRepository.class),mock(ProductRepository.class),mock(AuditLogService.class));
        var request=new CreateSupplierRequest();request.setName("New supplier");request.setSupplierCode("MANUAL");
        assertEquals("SUPP-0004",service.createSupplier(request).getSupplierCode());
        var existing=Supplier.builder().id(8L).supplierCode("SUPP-0004").name("New supplier").isActive(true).build();
        when(repository.findById(8L)).thenReturn(java.util.Optional.of(existing));
        request.setName("Updated supplier");request.setSupplierCode("CHANGED");
        try(var authorization=mockStatic(com.nbh.erp.security.SecurityUtils.class)) {
            assertEquals("SUPP-0004",service.updateSupplier(8L,request).getSupplierCode());
        }
    }
}
