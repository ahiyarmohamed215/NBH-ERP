package com.nbh.erp.customer.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.dto.CreateCustomerRequest;
import com.nbh.erp.customer.dto.CustomerDto;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.sales.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public List<CustomerDto> getAllCustomers() {
        return customerRepository.findAll().stream()
                .map(CustomerDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CustomerDto> getActiveCustomers() {
        return customerRepository.findByIsActiveTrue().stream()
                .map(CustomerDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CustomerDto> searchCustomers(String query) {
        if (!StringUtils.hasText(query)) {
            return getActiveCustomers();
        }
        return customerRepository.searchCustomers(query).stream()
                .map(CustomerDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CustomerDto getCustomerById(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", id));
        return CustomerDto.from(customer);
    }

    @Transactional
    public CustomerDto createCustomer(CreateCustomerRequest request) {
        String code = request.getCustomerCode();
        if (!StringUtils.hasText(code)) {
            long count = customerRepository.count() + 1;
            code = String.format("CUST-%04d", count);
        } else {
            code = code.trim().toUpperCase();
        }

        if (customerRepository.existsByCustomerCode(code)) {
            throw new DuplicateResourceException("Customer", "code", code);
        }

        Customer customer = Customer.builder()
                .customerCode(code)
                .name(request.getName().trim())
                .contactPerson(request.getContactPerson())
                .phone(request.getPhone())
                .email(request.getEmail())
                .address(request.getAddress())
                .creditLimit(request.getCreditLimit() != null ? request.getCreditLimit() : BigDecimal.ZERO)
                .currentBalance(BigDecimal.ZERO)
                .isActive(true)
                .build();

        Customer saved = customerRepository.save(customer);
        return CustomerDto.from(saved);
    }

    @Transactional
    public CustomerDto updateCustomer(Long id, CreateCustomerRequest request) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", id));

        if (StringUtils.hasText(request.getCustomerCode())) {
            String newCode = request.getCustomerCode().trim().toUpperCase();
            customerRepository.findByCustomerCode(newCode).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Customer", "code", newCode);
                }
            });
            customer.setCustomerCode(newCode);
        }

        customer.setName(request.getName().trim());
        customer.setContactPerson(request.getContactPerson());
        customer.setPhone(request.getPhone());
        customer.setEmail(request.getEmail());
        customer.setAddress(request.getAddress());
        if (request.getCreditLimit() != null) {
            customer.setCreditLimit(request.getCreditLimit());
        }

        Customer saved = customerRepository.save(customer);
        return CustomerDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", id));
        customer.setIsActive(!customer.getIsActive());
        customerRepository.save(customer);
    }

    @Transactional
    public void deleteCustomer(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", id));

        if (invoiceRepository.existsByCustomerId(id)) {
            throw new BusinessException("Cannot delete customer '" + customer.getName() + "' because historical invoices exist for this customer. Please deactivate the customer instead.");
        }

        customerRepository.delete(customer);
    }
}
