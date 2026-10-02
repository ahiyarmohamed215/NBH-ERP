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

    @Transactional(readOnly = true)
    public List<VehicleDto> getAllVehicles() {
        return vehicleRepository.findAll().stream().map(VehicleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<VehicleDto> getAvailableVehicles() {
        return vehicleRepository.findByStatusAndIsActiveTrue("AVAILABLE").stream().map(VehicleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public VehicleDto getVehicleById(Long id) {
        Vehicle v = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", "id", id));
        return VehicleDto.from(v);
    }

    @Transactional
    public VehicleDto createVehicle(CreateVehicleRequest req) {
        String num = req.getVehicleNumber().trim().toUpperCase();
        if (vehicleRepository.existsByVehicleNumber(num)) {
            throw new DuplicateResourceException("Vehicle", "vehicleNumber", num);
        }

        Vehicle v = Vehicle.builder()
                .vehicleNumber(num)
                .model(req.getModel().trim())
                .vehicleType(req.getVehicleType() != null ? req.getVehicleType() : "TRUCK")
                .capacityKg(req.getCapacityKg())
                .status(req.getStatus() != null ? req.getStatus() : "AVAILABLE")
                .isActive(true)
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

        String num = req.getVehicleNumber().trim().toUpperCase();
        if (!num.equalsIgnoreCase(v.getVehicleNumber()) && vehicleRepository.existsByVehicleNumber(num)) {
            throw new DuplicateResourceException("Vehicle", "vehicleNumber", num);
        }

        v.setVehicleNumber(num);
        v.setModel(req.getModel().trim());
        if (req.getVehicleType() != null) v.setVehicleType(req.getVehicleType());
        v.setCapacityKg(req.getCapacityKg());
        if (req.getStatus() != null) v.setStatus(req.getStatus());
        v.setNotes(req.getNotes());

        Vehicle saved = vehicleRepository.save(v);

        auditLogService.log("VEHICLE_UPDATE", "DELIVERY", "Vehicle", saved.getVehicleNumber(),
                String.format("Updated vehicle '%s' (%s, Status: %s)", saved.getVehicleNumber(), saved.getModel(), saved.getStatus()));

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
