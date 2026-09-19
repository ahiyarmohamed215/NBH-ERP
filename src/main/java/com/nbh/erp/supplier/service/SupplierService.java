package com.nbh.erp.supplier.service;

import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.supplier.dto.CreateSupplierRequest;
import com.nbh.erp.supplier.dto.SupplierDto;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;

    @Transactional(readOnly = true)
    public List<SupplierDto> getAllSuppliers() {
        return supplierRepository.findAll().stream()
                .map(SupplierDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierDto> getActiveSuppliers() {
        return supplierRepository.findByIsActiveTrue().stream()
                .map(SupplierDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierDto> searchSuppliers(String query) {
        if (!StringUtils.hasText(query)) {
            return getActiveSuppliers();
        }
        return supplierRepository.searchSuppliers(query).stream()
                .map(SupplierDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SupplierDto getSupplierById(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));
        return SupplierDto.from(supplier);
    }

    @Transactional
    public SupplierDto createSupplier(CreateSupplierRequest request) {
        String code = request.getSupplierCode();
        if (!StringUtils.hasText(code)) {
            long count = supplierRepository.count() + 1;
            code = String.format("SUPP-%04d", count);
        } else {
            code = code.trim().toUpperCase();
        }

        if (supplierRepository.existsBySupplierCode(code)) {
            throw new DuplicateResourceException("Supplier", "code", code);
        }

        Supplier supplier = Supplier.builder()
                .supplierCode(code)
                .name(request.getName().trim())
                .contactPerson(request.getContactPerson())
                .phone(request.getPhone())
                .email(request.getEmail())
                .address(request.getAddress())
                .isActive(true)
                .build();

        Supplier saved = supplierRepository.save(supplier);
        return SupplierDto.from(saved);
    }

    @Transactional
    public SupplierDto updateSupplier(Long id, CreateSupplierRequest request) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));

        if (StringUtils.hasText(request.getSupplierCode())) {
            String newCode = request.getSupplierCode().trim().toUpperCase();
            supplierRepository.findBySupplierCode(newCode).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Supplier", "code", newCode);
                }
            });
            supplier.setSupplierCode(newCode);
        }

        supplier.setName(request.getName().trim());
        supplier.setContactPerson(request.getContactPerson());
        supplier.setPhone(request.getPhone());
        supplier.setEmail(request.getEmail());
        supplier.setAddress(request.getAddress());

        Supplier saved = supplierRepository.save(supplier);
        return SupplierDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));
        supplier.setIsActive(!supplier.getIsActive());
        supplierRepository.save(supplier);
    }
}
