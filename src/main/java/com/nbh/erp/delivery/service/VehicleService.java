package com.nbh.erp.delivery.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.delivery.dto.CreateVehicleRequest;
import com.nbh.erp.delivery.dto.VehicleDto;
import com.nbh.erp.delivery.entity.Vehicle;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final AuditLogService auditLogService;
    private final com.nbh.erp.user.repository.UserRepository userRepository;

    private String text(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private void validateInput(CreateVehicleRequest req, boolean draft) {
        if (!draft && (text(req.getVehicleNumber()) == null || text(req.getModel()) == null))
            throw new com.nbh.erp.common.exception.BusinessException("Vehicle plate number and model are required before activation");
        if (!draft && text(req.getVehicleType()) == null) throw new com.nbh.erp.common.exception.BusinessException("Select a vehicle type before activation");
        if (text(req.getVehicleType()) != null && !java.util.Set.of("LORRY","TRUCK","THREEWHEEL","VAN").contains(req.getVehicleType()))
            throw new com.nbh.erp.common.exception.BusinessException("Select a valid vehicle type");
        if (draft && text(req.getVehicleNumber()) == null && text(req.getModel()) == null && text(req.getVehicleType()) == null && text(req.getNotes()) == null && req.getCapacityKg() == null && req.getAssignedStaffId() == null)
            throw new com.nbh.erp.common.exception.BusinessException("Fill at least one input before saving a vehicle draft");
        if (req.getCapacityKg() != null && (!Double.isFinite(req.getCapacityKg()) || req.getCapacityKg() < 0))
            throw new com.nbh.erp.common.exception.BusinessException("Vehicle capacity must be zero or greater");
        if (!draft || req.getAssignedStaffId() != null) responsibleStaff(req.getAssignedStaffId());
    }

    private com.nbh.erp.user.entity.User responsibleStaff(Long id) {
        if (id == null) throw new com.nbh.erp.common.exception.BusinessException("Select the staff member responsible for this vehicle");
        return userRepository.findById(id)
                .filter(user -> Boolean.TRUE.equals(user.getIsActive()) && !user.isDeleted()
                        && "APPROVED".equalsIgnoreCase(user.getApprovalStatus()))
                .orElseThrow(() -> new com.nbh.erp.common.exception.BusinessException("Select an active, approved staff member for this vehicle"));
    }

    @Transactional(readOnly = true)
    public List<VehicleDto> getAllVehicles() {
        return vehicleRepository.findAll().stream()
                .filter(v -> v.getDeletedAt() == null)
                .sorted(java.util.Comparator.comparing(
                        (Vehicle v) -> v.getUpdatedAt() != null ? v.getUpdatedAt() : v.getCreatedAt(),
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
                ).thenComparing(Vehicle::getId, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(VehicleDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<VehicleDto> getAvailableVehicles() {
        return vehicleRepository.findByStatusAndIsActiveTrue("AVAILABLE").stream().map(VehicleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public VehicleDto getVehicleById(Long id) {
        Vehicle v = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", "id", id));
        v.requireNotDeleted();
        return VehicleDto.from(v);
    }

    @Transactional
    public VehicleDto createVehicle(CreateVehicleRequest req) {
        validateInput(req, req.isDraft());
        String num = text(req.getVehicleNumber()) == null ? null : text(req.getVehicleNumber()).toUpperCase(java.util.Locale.ROOT);
        if (num != null && vehicleRepository.existsByVehicleNumber(num)) {
            throw new DuplicateResourceException("Vehicle", "vehicleNumber", num);
        }

        Vehicle v = Vehicle.builder()
                .vehicleNumber(num)
                .model(text(req.getModel()))
                .vehicleType(text(req.getVehicleType()))
                .capacityKg(req.getCapacityKg())
                .assignedStaff(req.getAssignedStaffId() != null ? responsibleStaff(req.getAssignedStaffId()) : null)
                .status(req.isDraft() ? "DRAFT" : "AVAILABLE")
                .isActive(!req.isDraft())
                .notes(req.getNotes())
                .build();

        Vehicle saved = vehicleRepository.save(v);

        auditLogService.log("VEHICLE_CREATE", "DELIVERY", "Vehicle", saved.getVehicleNumber(),
                String.format("Added vehicle '%s' (%s, Type: %s)", saved.getVehicleNumber(), saved.getModel(), saved.getVehicleType()));

        return VehicleDto.from(saved);
    }

    @Transactional
    public VehicleDto updateVehicle(Long id, CreateVehicleRequest req) {
        Vehicle v = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", "id", id));

        SecurityUtils.enforceCanEdit("DELIVERY", "Vehicle: " + v.getVehicleNumber());
        v.requireNotDeleted();
        validateInput(req, "DRAFT".equals(v.getStatus()));

        String num = text(req.getVehicleNumber()) == null ? null : text(req.getVehicleNumber()).toUpperCase(java.util.Locale.ROOT);
        if (num != null && !num.equalsIgnoreCase(v.getVehicleNumber()) && vehicleRepository.existsByVehicleNumber(num)) {
            throw new DuplicateResourceException("Vehicle", "vehicleNumber", num);
        }

        v.setVehicleNumber(num);
        v.setModel(text(req.getModel()));
        v.setVehicleType(text(req.getVehicleType()));
        v.setCapacityKg(req.getCapacityKg());
        v.setAssignedStaff(req.getAssignedStaffId() != null ? responsibleStaff(req.getAssignedStaffId()) : null);
        v.setNotes(req.getNotes());

        Vehicle saved = vehicleRepository.save(v);

        auditLogService.log("VEHICLE_UPDATE", "DELIVERY", "Vehicle", saved.getVehicleNumber(),
                String.format("Updated vehicle '%s' (%s, Status: %s)", saved.getVehicleNumber(), saved.getModel(), saved.getStatus()));

        return VehicleDto.from(saved);
    }

    @Transactional
    public VehicleDto changeStatus(Long id, String targetStatus, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        Vehicle vehicle = vehicleRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", "id", id));

        SecurityUtils.enforceCanEdit("DELIVERY", "Vehicle: " + vehicle.getVehicleNumber());
        vehicle.requireNotDeleted();

        String previousStatus = vehicle.getStatus();
        String normalizedTarget = targetStatus != null ? targetStatus.trim().toUpperCase() : "";
        if ("DRAFT".equals(normalizedTarget)) {
            throw new com.nbh.erp.common.exception.BusinessException("Cannot change vehicle status to draft");
        }
        if (!java.util.Set.of("AVAILABLE", "IN_GARAGE", "IN_SERVICE", "ON_DELIVERY", "MAINTENANCE", "INACTIVE").contains(normalizedTarget)) {
            throw new com.nbh.erp.common.exception.BusinessException("Invalid vehicle status: " + targetStatus);
        }
        if (normalizedTarget.equals(previousStatus)) {
            throw new com.nbh.erp.common.exception.BusinessException("Select a different status. Vehicle is already " + previousStatus.replace('_', ' '));
        }

        if ("DRAFT".equals(previousStatus) && !java.util.Set.of("DRAFT", "INACTIVE").contains(normalizedTarget)) {
            validateInput(CreateVehicleRequest.builder().vehicleNumber(vehicle.getVehicleNumber()).model(vehicle.getModel()).vehicleType(vehicle.getVehicleType())
                    .assignedStaffId(vehicle.getAssignedStaff() != null ? vehicle.getAssignedStaff().getId() : null).capacityKg(vehicle.getCapacityKg()).build(), false);
        }
        vehicle.setStatus(normalizedTarget);
        vehicle.setIsActive(!java.util.Set.of("DRAFT", "INACTIVE").contains(normalizedTarget));
        Vehicle saved = vehicleRepository.save(vehicle);

        auditLogService.log("VEHICLE_STATUS", "DELIVERY", "Vehicle", saved.getVehicleNumber(),
                String.format("Status changed from %s to %s. Reason: %s", previousStatus, normalizedTarget, reason));

        return VehicleDto.from(saved);
    }

    @Transactional
    public void deleteVehicle(Long id) {
        SecurityUtils.enforceNoDelete("Vehicle", id);
    }

    @Transactional
    public void seedDefaultVehiclesIfEmpty() {
        if (vehicleRepository.count() == 0) {
            vehicleRepository.save(Vehicle.builder()
                    .vehicleNumber("WP-CAB-4821")
                    .model("Isuzu Elf 4-Ton Truck")
                    .vehicleType("TRUCK")
                    .capacityKg(4000.0)
                    .status("AVAILABLE")
                    .isActive(true)
                    .notes("Primary heavy distribution truck")
                    .build());

            vehicleRepository.save(Vehicle.builder()
                    .vehicleNumber("WP-DA-9150")
                    .model("Toyota HiAce Delivery Van")
                    .vehicleType("VAN")
                    .capacityKg(1500.0)
                    .status("AVAILABLE")
                    .isActive(true)
                    .notes("Express city parcel van")
                    .build());

            vehicleRepository.save(Vehicle.builder()
                    .vehicleNumber("SP-LK-3320")
                    .model("Mitsubishi Canter 3.5T Lorry")
                    .vehicleType("LORRY")
                    .capacityKg(3500.0)
                    .status("AVAILABLE")
                    .isActive(true)
                    .notes("Southern highway distribution vehicle")
                    .build());

            log.info("Initialized default delivery fleet vehicles.");
        }
    }
}
