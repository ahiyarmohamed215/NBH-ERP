package com.nbh.erp;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.delivery.dto.CreateVehicleRequest;
import com.nbh.erp.delivery.entity.Vehicle;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.delivery.service.VehicleService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class VehicleAssignmentTest {
    @Test
    void migrationPreservesExistingVehiclesAndEnforcesStaffReference() throws Exception {
        try (var connection = java.sql.DriverManager.getConnection("jdbc:h2:mem:vehicle-assignment;MODE=MySQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE vehicles(id BIGINT PRIMARY KEY, vehicle_number VARCHAR(50) NOT NULL UNIQUE, model VARCHAR(100) NOT NULL)");
            statement.execute("CREATE TABLE delivery_routes(id BIGINT PRIMARY KEY)");
            statement.execute("INSERT INTO vehicles(id,vehicle_number,model) VALUES(1,'WP-LEGACY','Existing truck')");
            try (var script = getClass().getResourceAsStream("/db/migration/V49__vehicle_responsible_staff.sql")) {
                assertNotNull(script);
                for (String sql : new String(script.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).split(";")) {
                    if (!sql.isBlank()) statement.execute(sql);
                }
            }
            try (var rows = statement.executeQuery("SELECT assigned_staff_id FROM vehicles WHERE id=1")) {
                assertTrue(rows.next());
                assertNull(rows.getObject(1));
            }
            assertThrows(java.sql.SQLException.class, () -> statement.execute("UPDATE vehicles SET assigned_staff_id=99 WHERE id=1"));
            statement.execute("INSERT INTO users(id) VALUES(7)");
            statement.execute("UPDATE vehicles SET assigned_staff_id=7 WHERE id=1");
            try (var script = getClass().getResourceAsStream("/db/migration/V50__delivery_recycle_bin_and_vehicle_drafts.sql")) {
                assertNotNull(script);
                for (String sql : new String(script.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).split(";")) if (!sql.isBlank()) statement.execute(sql);
            }
            statement.execute("INSERT INTO vehicles(id,model) VALUES(2,'Incomplete draft')");
            try (var rows = statement.executeQuery("SELECT vehicle_number, deleted_at FROM vehicles WHERE id=1")) {
                assertTrue(rows.next());assertEquals("WP-LEGACY",rows.getString(1));assertNull(rows.getObject(2));
            }
        }
    }

    @Test
    void staffIsRequiredAndVehicleEditsCannotChangeStatus() {
        var vehicles = mock(VehicleRepository.class);
        var users = mock(UserRepository.class);
        var service = new VehicleService(vehicles, mock(AuditLogService.class), users);
        var staff = User.builder().id(7L).fullName("Vehicle caretaker").employeeCode("EMP-0007")
                .isActive(true).approvalStatus("APPROVED").build();
        when(users.findById(7L)).thenReturn(Optional.of(staff));
        when(users.findById(99L)).thenReturn(Optional.empty());
        when(vehicles.save(any(Vehicle.class))).thenAnswer(call -> call.getArgument(0));
        var request = CreateVehicleRequest.builder().vehicleNumber("WP-1234").model("Threewheel")
                .vehicleType("THREEWHEEL").assignedStaffId(7L).status("IN_GARAGE").build();
        var created = service.createVehicle(request);
        assertEquals("AVAILABLE", created.getStatus());
        assertEquals(7L, created.getAssignedStaffId());
        assertEquals("Vehicle caretaker", created.getAssignedStaffName());
        assertEquals("EMP-0007", created.getAssignedStaffEmployeeCode());

        var draft = service.createVehicle(CreateVehicleRequest.builder().model("Unfinished vehicle").draft(true).build());
        assertEquals("DRAFT", draft.getStatus());assertFalse(draft.getIsActive());assertNull(draft.getVehicleNumber());assertNull(draft.getAssignedStaffId());
        assertNull(draft.getVehicleType(), "Drafts do not get an automatically selected vehicle type");
        assertThrows(BusinessException.class, () -> service.createVehicle(CreateVehicleRequest.builder().draft(true).build()));
        assertThrows(BusinessException.class, () -> service.createVehicle(CreateVehicleRequest.builder().vehicleNumber("TYPE-MISSING").model("Truck").assignedStaffId(7L).build()));

        request.setAssignedStaffId(null);
        assertThrows(BusinessException.class, () -> service.createVehicle(request));
        request.setAssignedStaffId(99L);
        assertThrows(BusinessException.class, () -> service.createVehicle(request));
        request.setAssignedStaffId(7L);
        staff.setIsActive(false);
        assertThrows(BusinessException.class, () -> service.createVehicle(request));
        staff.setIsActive(true);
        staff.setApprovalStatus("PENDING");
        assertThrows(BusinessException.class, () -> service.createVehicle(request));
        staff.setApprovalStatus("APPROVED");

        var legacy = Vehicle.builder().id(10L).vehicleNumber("WP-1234").model("Old truck").status("IN_SERVICE").build();
        when(vehicles.findById(10L)).thenReturn(Optional.of(legacy));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin", "", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        try {
            request.setStatus("AVAILABLE");
            assertEquals("IN_SERVICE", service.updateVehicle(10L, request).getStatus());
            assertSame(staff, legacy.getAssignedStaff());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
