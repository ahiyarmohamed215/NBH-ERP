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

    private void validateInput(CreateSupplierRequest request, String status) {
        if(request.getName()!=null)request.setName(request.getName().trim());
        if(request.getSupplierCode()!=null)request.setSupplierCode(request.getSupplierCode().trim());
        if(request.getEmail()!=null)request.setEmail(request.getEmail().trim());
        request.setPhone(com.nbh.erp.common.validation.PhoneValidator.normalize(request.getPhone()));
        if(request.getName()!=null && request.getName().isBlank())request.setName(null);
        if(!"DRAFT".equals(status) && !StringUtils.hasText(request.getName())) throw new BusinessException("Supplier name is required before activation");
        if(request.getName()!=null && request.getName().length()<2)throw new BusinessException("Supplier name must contain 2–150 characters");
        if("DRAFT".equals(status) && !java.util.stream.Stream.of(request.getName(),request.getContactPerson(),request.getPhone(),request.getEmail(),request.getAddress()).anyMatch(StringUtils::hasText))throw new BusinessException("Fill at least one input before saving a supplier draft");
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
        String status=request.getStatus()!=null?request.getStatus():"ACTIVE";
        if(!java.util.Set.of("DRAFT","ACTIVE").contains(status))throw new BusinessException("New suppliers must be draft or active");
        validateInput(request,status);
        long next = supplierRepository.count() + 1;
        String code;
        do { code = String.format("SUPP-%04d", next++); }
        while (supplierRepository.existsBySupplierCode(code));

        Supplier supplier = Supplier.builder()
                .supplierCode(code)
                .name(request.getName())
                .contactPerson(request.getContactPerson())
                .phone(request.getPhone())
                .email(request.getEmail())
                .address(request.getAddress())
                .isActive("ACTIVE".equals(status))
                .status(status)
                .build();

        Supplier saved = supplierRepository.save(supplier);

        auditLogService.log("SUPPLIER_CREATE", "PURCHASING", "Supplier", saved.getSupplierCode(),
                String.format("Created supplier '%s' (Code: %s)", saved.getName(), saved.getSupplierCode()));

        return SupplierDto.from(saved);
    }

    @Transactional
    public SupplierDto updateSupplier(Long id, CreateSupplierRequest request) {
        Supplier supplier = supplierRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", id));

        SecurityUtils.enforceCanEdit("SUPPLIER", "Supplier: " + supplier.getName());

        if(request.getStatus()!=null && !request.getStatus().equals(supplier.getStatus()))throw new BusinessException("Change supplier status from the view popup with a reason");
        validateInput(request,supplier.getStatus());
        supplier.setName(request.getName());
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
        Supplier supplier=supplierRepository.findByIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("Supplier","id",id));
        changeStatus(id,Boolean.TRUE.equals(supplier.getIsActive())?"INACTIVE":"ACTIVE",reason);
    }

    @Transactional
    public SupplierDto changeStatus(Long id,String target,String reason) {
        reason=com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        if(!java.util.Set.of("DRAFT","ACTIVE","INACTIVE").contains(target))throw new BusinessException("Invalid supplier status");
        Supplier supplier=supplierRepository.findByIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("Supplier","id",id));
        SecurityUtils.enforceCanEdit("SUPPLIER","Supplier: "+supplier.getSupplierCode());
        String previous=supplier.getStatus();
        var input=new CreateSupplierRequest();input.setName(supplier.getName());input.setContactPerson(supplier.getContactPerson());input.setPhone(supplier.getPhone());input.setEmail(supplier.getEmail());input.setAddress(supplier.getAddress());
        if(!"INACTIVE".equals(target))validateInput(input,target);
        supplier.setStatus(target);supplier.setIsActive("ACTIVE".equals(target));
        Supplier saved=supplierRepository.save(supplier);
        auditLogService.log("SUPPLIER_STATUS","PURCHASING","Supplier",supplier.getSupplierCode(),previous+" -> "+target+": "+reason);
        return SupplierDto.from(saved);
    }

    @Transactional
    public void deleteSupplier(Long id) {
        SecurityUtils.enforceNoDelete("Supplier", id);
    }
}
