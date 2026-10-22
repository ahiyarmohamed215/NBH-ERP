package com.nbh.erp.sales.service;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HeldBillStaffTest {
    @Test void resolvesCreatorInOneBatchAndPreservesSavedIdentity(){
        var users=mock(UserRepository.class);var service=new HeldBillStaff(users);
        var staff=User.builder().id(42L).username("cashier").fullName("Nimal Perera").employeeCode("EMP-0042").build();
        when(users.findByUsernameIn(List.of("cashier","unknown"))).thenReturn(List.of(staff));
        var first=InvoiceDto.builder().createdBy("cashier").salesmanName("Different sales rep").build();
        var second=InvoiceDto.builder().createdBy("cashier").build();
        var missing=InvoiceDto.builder().createdBy("unknown").build();
        var saved=InvoiceDto.builder().createdBy("cashier").createdByName("Original name").createdByEmployeeCode("EMP-OLD").build();
        service.enrich(List.of(first,second,missing,saved));
        assertEquals("Nimal Perera",first.getCreatedByName());assertEquals("EMP-0042",second.getCreatedByEmployeeCode());
        assertEquals("Original name",saved.getCreatedByName());assertEquals("EMP-OLD",saved.getCreatedByEmployeeCode());
        assertNull(missing.getCreatedByName());assertEquals("unknown",missing.getCreatedBy());
        verify(users,times(1)).findByUsernameIn(List.of("cashier","unknown"));
    }
    @Test void legacyStaffUsesStableEmployeeCode(){
        var users=mock(UserRepository.class);var staff=User.builder().id(9L).username("legacy").fullName("").build();
        when(users.findByUsernameIn(List.of("legacy"))).thenReturn(List.of(staff));
        var bill=InvoiceDto.builder().createdBy("legacy").build();new HeldBillStaff(users).enrich(bill);
        assertEquals("legacy",bill.getCreatedByName());assertEquals("EMP-0009",bill.getCreatedByEmployeeCode());
    }
}
