package com.nbh.erp;

import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.supplier.service.SupplierService;
import com.nbh.erp.supplier.dto.CreateSupplierRequest;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.common.exception.BusinessException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class SupplierRecycleBinTest {
    @Autowired SupplierService service;
    @Autowired SupplierRepository suppliers;
    @Autowired GrnRepository grns;
    @Autowired WarehouseRepository warehouses;
    @Autowired EntityManager entityManager;

    @BeforeEach void authorize() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("supplier-manager", "test", List.of(new SimpleGrantedAuthority("SUPPLIER_MANAGE"))));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    Supplier supplier(String status) {
        return suppliers.saveAndFlush(Supplier.builder().supplierCode("BIN-" + java.util.UUID.randomUUID().toString().substring(0,8)).name("Lanka Trading").status(status).isActive("ACTIVE".equals(status)).contactPerson("Nimal").phone("0771234567").email("test@example.test").address("Colombo").build());
    }

    @Test void deletionAndRestorePreserveLinkedReceiptAndPreviousStatus() {
        Supplier supplier = supplier("ACTIVE");
        Warehouse warehouse = warehouses.saveAndFlush(Warehouse.builder().code("BIN-WH").name("Test warehouse").build());
        Grn grn = grns.saveAndFlush(Grn.builder().grnNumber("BIN-GRN").supplier(supplier).warehouse(warehouse).receivedDate(java.time.LocalDate.now()).status("PROCESSED").build());
        service.deleteSupplier(supplier.getId()); entityManager.flush(); entityManager.clear();
        assertFalse(service.getAllSuppliers().stream().anyMatch(s -> s.getId().equals(supplier.getId())));
        assertFalse(service.getActiveSuppliers().stream().anyMatch(s -> s.getId().equals(supplier.getId())));
        assertTrue(service.searchSuppliers("Lanka Trading").isEmpty());
        assertEquals(1, service.getRecycleBin().stream().filter(s -> s.getId().equals(supplier.getId())).count());
        Grn linked = grns.findById(grn.getId()).orElseThrow();
        assertEquals("Lanka Trading (deleted from the system)", GrnDto.from(linked).getSupplierName());
        assertEquals("PROCESSED", linked.getStatus());
        assertThrows(BusinessException.class, () -> service.changeStatus(supplier.getId(), "ACTIVE", "Reactivate"));
        var input = new CreateSupplierRequest(); input.setName("Changed name");
        assertThrows(BusinessException.class, () -> service.updateSupplier(supplier.getId(), input));
        var restored = service.restoreSupplier(supplier.getId());
        assertEquals("Lanka Trading", restored.getName()); assertEquals("ACTIVE", restored.getStatus()); assertTrue(restored.getIsActive());
        assertNull(restored.getDeletedAt()); assertEquals("Lanka Trading", GrnDto.from(linked).getSupplierName());
        service.deleteSupplier(supplier.getId()); service.permanentlyDeleteSupplier(supplier.getId()); entityManager.flush(); entityManager.clear();
        Grn retained = grns.findById(grn.getId()).orElseThrow();
        assertEquals("PROCESSED", retained.getStatus());
        assertEquals(supplier.getId(), retained.getSupplier().getId());
        assertEquals("Lanka Trading (deleted from the system)", GrnDto.from(retained).getSupplierName());
    }

    @Test void permanentDeletionErasesContactsAndCannotBeRestored() {
        Supplier supplier = supplier("INACTIVE");
        assertThrows(BusinessException.class, () -> service.permanentlyDeleteSupplier(supplier.getId()));
        service.deleteSupplier(supplier.getId()); service.permanentlyDeleteSupplier(supplier.getId()); entityManager.flush(); entityManager.clear();
        assertTrue(service.getRecycleBin().stream().noneMatch(s -> s.getId().equals(supplier.getId())));
        assertThrows(BusinessException.class, () -> service.restoreSupplier(supplier.getId()));
        Supplier history = suppliers.findById(supplier.getId()).orElseThrow();
        assertEquals("Lanka Trading (deleted from the system)", history.getDisplayName());
        assertNull(history.getEmail()); assertNull(history.getPhone()); assertNull(history.getContactPerson()); assertNull(history.getAddress());
        assertNotNull(history.getPurgedAt()); assertFalse(history.getIsActive());
    }

    @Test void inactiveAndDraftSuppliersRestoreWithoutActivation() {
        for (String status : List.of("INACTIVE", "DRAFT")) {
            Supplier supplier = supplier(status); service.deleteSupplier(supplier.getId());
            var restored = service.restoreSupplier(supplier.getId()); assertEquals(status, restored.getStatus()); assertFalse(restored.getIsActive());
        }
    }

    @Test void supplierViewCannotDeleteOrRestore() {
        Supplier supplier = supplier("ACTIVE");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("viewer", "test", List.of(new SimpleGrantedAuthority("SUPPLIER_VIEW"))));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.deleteSupplier(supplier.getId()));
        assertFalse(supplier.isDeleted());
    }

    @Test void recycleBinMigrationPreservesExistingSuppliers() throws Exception {
        String url = "jdbc:h2:mem:supplier-bin-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = java.sql.DriverManager.getConnection(url,"sa",""); var sql = connection.createStatement()) {
            sql.execute("create table suppliers(id bigint primary key,name varchar(150),is_active boolean,supplier_status varchar(20))");
            sql.execute("insert into suppliers values(1,'Existing supplier',true,'ACTIVE')");
        }
        var flyway = org.flywaydb.core.Flyway.configure().locations("classpath:db/migration").dataSource(url,"sa","").baselineOnMigrate(true).baselineVersion("23").target("24").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        try (var connection = java.sql.DriverManager.getConnection(url,"sa",""); var sql = connection.createStatement(); var rows = sql.executeQuery("select * from suppliers")) {
            assertTrue(rows.next()); assertEquals("Existing supplier",rows.getString("name"));assertTrue(rows.getBoolean("is_active"));assertNull(rows.getTimestamp("deleted_at"));assertNull(rows.getTimestamp("purged_at"));
        }
    }
}
