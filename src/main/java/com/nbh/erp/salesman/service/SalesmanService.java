package com.nbh.erp.salesman.service;

import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.salesman.dto.CreateSalesmanRequest;
import com.nbh.erp.salesman.dto.SalesmanDto;
import com.nbh.erp.salesman.entity.Salesman;
import com.nbh.erp.salesman.repository.SalesmanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SalesmanService {

    private final SalesmanRepository salesmanRepository;

    @Transactional(readOnly = true)
    public List<SalesmanDto> getAllSalesmen() {
        return salesmanRepository.findAll().stream()
                .map(SalesmanDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SalesmanDto> getActiveSalesmen() {
        return salesmanRepository.findByIsActiveTrue().stream()
                .map(SalesmanDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SalesmanDto getSalesmanById(Long id) {
        Salesman salesman = salesmanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Salesman", "id", id));
        return SalesmanDto.from(salesman);
    }

    @Transactional
    public SalesmanDto createSalesman(CreateSalesmanRequest request) {
        String code = request.getSalesmanCode();
        if (!StringUtils.hasText(code)) {
            long count = salesmanRepository.count() + 1;
            code = String.format("REP-%03d", count);
        } else {
            code = code.trim().toUpperCase();
        }

        if (salesmanRepository.existsBySalesmanCode(code)) {
            throw new DuplicateResourceException("Salesman", "code", code);
        }

        Salesman salesman = Salesman.builder()
                .salesmanCode(code)
                .name(request.getName().trim())
                .phone(request.getPhone())
                .email(request.getEmail())
                .commissionRate(request.getCommissionRate() != null ? request.getCommissionRate() : BigDecimal.ZERO)
                .isActive(true)
                .build();

        Salesman saved = salesmanRepository.save(salesman);
        return SalesmanDto.from(saved);
    }

    @Transactional
    public SalesmanDto updateSalesman(Long id, CreateSalesmanRequest request) {
        Salesman salesman = salesmanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Salesman", "id", id));

        if (StringUtils.hasText(request.getSalesmanCode())) {
            String newCode = request.getSalesmanCode().trim().toUpperCase();
            salesmanRepository.findBySalesmanCode(newCode).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Salesman", "code", newCode);
                }
            });
            salesman.setSalesmanCode(newCode);
        }

        salesman.setName(request.getName().trim());
        salesman.setPhone(request.getPhone());
        salesman.setEmail(request.getEmail());
        if (request.getCommissionRate() != null) {
            salesman.setCommissionRate(request.getCommissionRate());
        }

        Salesman saved = salesmanRepository.save(salesman);
        return SalesmanDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Salesman salesman = salesmanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Salesman", "id", id));
        salesman.setIsActive(!salesman.getIsActive());
        salesmanRepository.save(salesman);
    }
}
