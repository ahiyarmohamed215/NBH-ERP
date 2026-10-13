package com.nbh.erp.supplier.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.security.SecurityUtils;
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

    private final jakarta.validation.Validator validator;
    private final SupplierRepository supplierRepository;
    private final GrnRepository grnRepository;
    private final ProductRepository productRepository;
    private final AuditLogService auditLogService;

    private void validateInput(CreateSupplierRequest request) {
        if(request.getName()!=null)request.setName(request.getName().trim());
        if(request.getSupplierCode()!=null)request.setSupplierCode(request.getSupplierCode().trim());
        if(request.getEmail()!=null)request.setEmail(request.getEmail().trim());
        request.setPhone(com.nbh.erp.common.validation.PhoneValidator.normalize(request.getPhone()));
        var violations=validator.validate(request);
        if(!violations.isEmpty())throw new BusinessException(violations.stream().map(jakarta.validation.ConstraintViolation::getMessage).sorted().collect(java.util.stream.Collectors.joining("; ")));
    }

    @Transactional(readOnly = true)
    public List<SupplierDto> getAllSuppliers() {
        return supplierRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt","id")).stream()
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
        validateInput(request);
        long next = supplierRepository.count() + 1;
        String code;
        do { code = String.format("SUPP-%04d", next++); }
        while (supplierRepository.existsBySupplierCode(code));

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

        auditLogService.log("SUPPLIER_CREATE", "PURCHASING", "Supplier", saved.getSupplierCode(),
                String.format("Created supplier '%s' (Code: %s)", saved.getName(), saved.getSupplierCode()));

        return SupplierDto.from(saved);
    }

    @Transactional
    public SupplierDto updateSupplier(Long id, CreateSupplierRequest request) {
        validateInput(request);
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));

        SecurityUtils.enforceCanEdit("SUPPLIER", "Supplier: " + supplier.getName());

        supplier.setName(request.getName().trim());
        supplier.setContactPerson(request.getContactPerson());
        supplier.setPhone(request.getPhone());
        supplier.setEmail(request.getEmail());
        supplier.setAddress(request.getAddress());

        Supplier saved = supplierRepository.save(supplier);

        auditLogService.log("SUPPLIER_UPDATE", "PURCHASING", "Supplier", saved.getSupplierCode(),
                String.format("Updated supplier '%s' (Code: %s)", saved.getName(), saved.getSupplierCode()));

        return SupplierDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        Supplier supplier = supplierRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));

        SecurityUtils.enforceCanEdit("SUPPLIER", "Supplier: " + supplier.getName());

        String previous = Boolean.TRUE.equals(supplier.getIsActive()) ? "ACTIVE" : "INACTIVE";
        supplier.setIsActive(!supplier.getIsActive());
        supplierRepository.save(supplier);

        auditLogService.log("SUPPLIER_STATUS", "PURCHASING", "Supplier", supplier.getSupplierCode(),
                previous + " -> " + (supplier.getIsActive() ? "ACTIVE" : "INACTIVE") + ": " + reason);
    }

    @Transactional
    public void deleteSupplier(Long id) {
        SecurityUtils.enforceNoDelete("Supplier", id);
    }
}
