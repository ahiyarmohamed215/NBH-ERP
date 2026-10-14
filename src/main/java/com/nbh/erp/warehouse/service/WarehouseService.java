package com.nbh.erp.warehouse.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.warehouse.dto.CreateWarehouseRequest;
import com.nbh.erp.warehouse.dto.WarehouseDto;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nbh.erp.common.validation.MasterRecordLifecycle;
import com.nbh.erp.common.dto.StatusChangeRequest;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WarehouseService {
    @org.springframework.beans.factory.annotation.Autowired private com.nbh.erp.recyclebin.RecycleBinService recycleBin;

    private final WarehouseRepository warehouseRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final InvoiceRepository invoiceRepository;
    private final GrnRepository grnRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<WarehouseDto> getAllWarehouses() {
        return warehouseRepository.findAll().stream()
                .map(WarehouseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WarehouseDto> getActiveWarehouses() {
        return warehouseRepository.findByIsActiveTrue().stream()
                .map(WarehouseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WarehouseDto getWarehouseById(Long id) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));
        return WarehouseDto.from(warehouse);
    }

    @Transactional
    public WarehouseDto createWarehouse(CreateWarehouseRequest request) {
        String status = MasterRecordLifecycle.initialStatus(request.getStatus());
        MasterRecordLifecycle.validate("Warehouse", status, request.getName(), request.getAddress(), request.getPhone(), request.getContactPerson(), request.getCode());
        request.setCode(MasterRecordLifecycle.code(request.getCode(), "WH", warehouseRepository.count(), warehouseRepository::existsByCode));
        if (warehouseRepository.existsByCode(request.getCode())) {
            throw new DuplicateResourceException("Warehouse", "code", request.getCode());
        }

        Warehouse warehouse = Warehouse.builder()
                .code(request.getCode().trim().toUpperCase())
                .name(MasterRecordLifecycle.clean(request.getName()))
                .address(request.getAddress())
                .phone(request.getPhone())
                .contactPerson(request.getContactPerson())
                .isActive("ACTIVE".equals(status))
                .status(status)
                .build();

        Warehouse saved = warehouseRepository.save(warehouse);

        auditLogService.log("WAREHOUSE_CREATE", "INVENTORY", "Warehouse", saved.getCode(),
                String.format("Created warehouse facility '%s' (Code: %s)", saved.getName(), saved.getCode()));

        return WarehouseDto.from(saved);
    }

    @Transactional
    public WarehouseDto updateWarehouse(Long id, CreateWarehouseRequest request) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));

        SecurityUtils.enforceCanEdit("WAREHOUSE", "Warehouse: " + warehouse.getName());
        warehouse.requireNotDeleted();
        MasterRecordLifecycle.validate("Warehouse", warehouse.getStatus(), request.getName(), request.getAddress(), request.getPhone(), request.getContactPerson(), request.getCode());

        request.setCode(org.springframework.util.StringUtils.hasText(request.getCode()) ? request.getCode().trim().toUpperCase() : warehouse.getCode());

        warehouseRepository.findByCode(request.getCode().trim().toUpperCase())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new DuplicateResourceException("Warehouse", "code", request.getCode());
                    }
                });

        warehouse.setCode(request.getCode().trim().toUpperCase());
        warehouse.setName(MasterRecordLifecycle.clean(request.getName()));
        warehouse.setAddress(request.getAddress());
        warehouse.setPhone(request.getPhone());
        warehouse.setContactPerson(request.getContactPerson());

        Warehouse saved = warehouseRepository.save(warehouse);

        auditLogService.log("WAREHOUSE_UPDATE", "INVENTORY", "Warehouse", saved.getCode(),
                String.format("Updated warehouse facility '%s' (Code: %s)", saved.getName(), saved.getCode()));

        return WarehouseDto.from(saved);
    }

    @Transactional
    public WarehouseDto changeStatus(Long id, String target, String reason) {
        target = MasterRecordLifecycle.targetStatus(target);
        reason = StatusChangeRequest.requireReason(reason);
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));
        SecurityUtils.enforceCanEdit("WAREHOUSE", "Warehouse: " + warehouse.getCode());
        warehouse.requireNotDeleted();
        MasterRecordLifecycle.validate("Warehouse", target, warehouse.getName(), warehouse.getCode());
        String previous = warehouse.getStatus();
        warehouse.setStatus(target);
        warehouse.setIsActive("ACTIVE".equals(target));
        Warehouse saved = warehouseRepository.save(warehouse);
        auditLogService.log("WAREHOUSE_STATUS", "INVENTORY", "Warehouse", warehouse.getCode(), previous + " -> " + target + ": " + reason);
        return WarehouseDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Warehouse record = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));
        changeStatus(id, "ACTIVE".equals(record.getStatus()) ? "INACTIVE" : "ACTIVE", "Changed from legacy status control");
    }

    @Transactional
    public void deleteWarehouse(Long id) {
        recycleBin.delete("WAREHOUSE", id);
    }
}

