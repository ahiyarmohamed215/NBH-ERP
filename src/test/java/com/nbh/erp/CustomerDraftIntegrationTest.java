package com.nbh.erp;

import com.nbh.erp.customer.dto.CreateCustomerRequest;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customer.service.CustomerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
@WithMockUser(roles="ADMIN")
class CustomerDraftIntegrationTest {
    @Autowired CustomerService customers;
    @Autowired CustomerRepository repository;

    private CreateCustomerRequest request(String name, boolean draft) {
        var request = new CreateCustomerRequest();
        request.setName(name); request.setDraft(draft);
        return request;
    }

    @Test void draftsPersistCanBeEditedAndActivateExplicitly() {
        var created = customers.createCustomer(request("Draft customer", true));
        assertEquals("DRAFT", created.getStatus());
        assertFalse(created.getIsActive());
        assertTrue(customers.getDirectoryCustomers().stream().anyMatch(c -> c.getId().equals(created.getId())));
        assertTrue(customers.getActiveCustomers().stream().noneMatch(c -> c.getId().equals(created.getId())));
        assertTrue(customers.searchCustomers("Draft customer").stream().noneMatch(c -> c.getId().equals(created.getId())));
        var edited = customers.updateCustomer(created.getId(), request("Edited draft", true));
        assertEquals("DRAFT", edited.getStatus());
        var active = customers.updateCustomer(created.getId(), request("Ready customer", false));
        assertEquals("ACTIVE", active.getStatus());
        assertTrue(customers.getActiveCustomers().stream().anyMatch(c -> c.getId().equals(created.getId())));
    }

    @Test void inactiveCustomersRemainInDirectoryAndCanBeReactivated() {
        var created = customers.createCustomer(request("Directory customer", false));
        customers.toggleActive(created.getId());
        assertTrue(customers.getAllCustomers().stream().noneMatch(c -> c.getId().equals(created.getId())));
        var inactive = customers.getDirectoryCustomers().stream().filter(c -> c.getId().equals(created.getId())).findFirst().orElseThrow();
        assertEquals("INACTIVE", inactive.getStatus());
        customers.toggleActive(created.getId());
        assertEquals("ACTIVE", customers.getCustomerById(created.getId()).getStatus());
    }

    @Test void activeCustomersCannotBeMovedBackToDraft() {
        var created = customers.createCustomer(request("Live customer", false));
        assertThrows(com.nbh.erp.common.exception.BusinessException.class,
            () -> customers.updateCustomer(created.getId(), request("Live customer", true)));
    }
}
