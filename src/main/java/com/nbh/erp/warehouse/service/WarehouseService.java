package com.nbh.erp.warehouse.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.repository.StockBalanceRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.warehouse.dto.CreateWarehouseRequest;
import com.nbh.erp.warehouse.dto.WarehouseDto;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final InvoiceRepository invoiceRepository;
    private final GrnRepository grnRepository;

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
        if (warehouseRepository.existsByCode(request.getCode())) {
            throw new DuplicateResourceException("Warehouse", "code", request.getCode());
        }

        Warehouse warehouse = Warehouse.builder()
                .code(request.getCode().trim().toUpperCase())
                .name(request.getName().trim())
                .address(request.getAddress())
                .phone(request.getPhone())
                .contactPerson(request.getContactPerson())
                .isActive(true)
                .build();

        Warehouse saved = warehouseRepository.save(warehouse);
        return WarehouseDto.from(saved);
    }

    @Transactional
    public WarehouseDto updateWarehouse(Long id, CreateWarehouseRequest request) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));

        warehouseRepository.findByCode(request.getCode().trim().toUpperCase())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new DuplicateResourceException("Warehouse", "code", request.getCode());
                    }
                });

        warehouse.setCode(request.getCode().trim().toUpperCase());
        warehouse.setName(request.getName().trim());
        warehouse.setAddress(request.getAddress());
        warehouse.setPhone(request.getPhone());
        warehouse.setContactPerson(request.getContactPerson());

        Warehouse saved = warehouseRepository.save(warehouse);
        return WarehouseDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));
        warehouse.setIsActive(!warehouse.getIsActive());
        warehouseRepository.save(warehouse);
    }

    @Transactional
    public void deleteWarehouse(Long id) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", id));

        warehouse.setIsActive(false);
        warehouseRepository.save(warehouse);
    }
}

