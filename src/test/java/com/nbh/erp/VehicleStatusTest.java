package com.nbh.erp;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.delivery.dto.CreateVehicleRequest;
import com.nbh.erp.delivery.dto.VehicleDto;
import com.nbh.erp.delivery.service.VehicleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class VehicleStatusTest {

    @Autowired
    private VehicleService vehicleService;

    @Autowired
    private com.nbh.erp.user.repository.UserRepository userRepository;

    @BeforeEach
    void setUpSecurity() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin",
                        "password",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("DELIVERY_MANAGE"))
                )
        );
    }

    @Test
    void testVehicleStatusTransitionsAndValidation() {
        String vehicleNumber = "TEST-VEH-" + System.currentTimeMillis();
        Long staffId = userRepository.save(com.nbh.erp.user.entity.User.builder()
                .username("vehicle-maintainer-test").email("vehicle-maintainer-test@example.com")
                .password("unused-in-test").fullName("Vehicle Maintainer")
                .isActive(true).approvalStatus("APPROVED").build()).getId();
        VehicleDto created = vehicleService.createVehicle(CreateVehicleRequest.builder()
                .vehicleNumber(vehicleNumber)
                .model("Tata Prima 2528.K")
                .vehicleType("TRUCK")
                .capacityKg(12000.0)
                .assignedStaffId(staffId)
                .status("DRAFT")
                .notes("New test vehicle")
                .build());

        assertNotNull(created.getId());
        assertEquals("AVAILABLE", created.getStatus());
        assertEquals(staffId, vehicleService.getVehicleById(created.getId()).getAssignedStaffId());

        // Change to IN_SERVICE
        VehicleDto inService = vehicleService.changeStatus(created.getId(), "IN_SERVICE", "Scheduled 50,000km engine maintenance");
        assertEquals("IN_SERVICE", inService.getStatus());

        // Change to IN_GARAGE
        VehicleDto inGarage = vehicleService.changeStatus(created.getId(), "IN_GARAGE", "Parked at central workshop yard");
        assertEquals("IN_GARAGE", inGarage.getStatus());
        VehicleDto edited = vehicleService.updateVehicle(created.getId(), CreateVehicleRequest.builder()
                .vehicleNumber(vehicleNumber).model("Updated truck").vehicleType("THREEWHEEL")
                .assignedStaffId(staffId).status("AVAILABLE").build());
        assertEquals("IN_GARAGE", edited.getStatus(), "Editing vehicle details preserves its status");
        assertEquals(staffId, edited.getAssignedStaffId());
        assertEquals("THREEWHEEL", edited.getVehicleType());

        // Cannot change created vehicle back to DRAFT
        assertThrows(BusinessException.class, () ->
                vehicleService.changeStatus(created.getId(), "DRAFT", "Pending registration verification")
        );

        // Change back to AVAILABLE
        VehicleDto available = vehicleService.changeStatus(created.getId(), "AVAILABLE", "Vehicle passed inspection and ready for duty");
        assertEquals("AVAILABLE", available.getStatus());

        // Test invalid status
        assertThrows(BusinessException.class, () ->
                vehicleService.changeStatus(created.getId(), "INVALID_STATUS", "Some reason")
        );

        // Test blank reason
        assertThrows(BusinessException.class, () ->
                vehicleService.changeStatus(created.getId(), "IN_GARAGE", "   ")
        );
    }
}
