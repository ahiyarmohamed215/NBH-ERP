package com.nbh.erp.sales.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.enums.InvoiceStatus;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.sales.dto.CashierAccountingDto;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.dto.UpdateInvoiceRequest;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import com.nbh.erp.inventory.service.ProductStaffQuotaService;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ProductStaffQuotaService productStaffQuotaService;

    public String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getName();
    }

    public boolean canViewAllSales() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_SUPER_ADMIN".equals(a.getAuthority()) ||
                "ROLE_ADMIN".equals(a.getAuthority()) ||
                "SALES_VIEW_ALL".equals(a.getAuthority())
        );
    }

    @Transactional(readOnly = true)
    public PagedResponse<InvoiceDto> searchInvoices(
            Long warehouseId,
            Long customerId,
            String status,
            String paymentType,
            LocalDate startDate,
            LocalDate endDate,
            String cashier,
            String query,
            Pageable pageable
    ) {
        String effectiveCashier = cashier;
        if (!canViewAllSales()) {
            // Non-supervisor cashiers can ONLY view their own billing history
            effectiveCashier = getCurrentUsername();
        } else if (cashier != null && cashier.isBlank()) {
            effectiveCashier = null;
        }

        Page<InvoiceDto> page = invoiceRepository
                .searchInvoices(warehouseId, customerId, status, paymentType, startDate, endDate, effectiveCashier, query, pageable)
                .map(InvoiceDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> getHeldInvoices(String cashier) {
        if (!canViewAllSales()) {
            // Non-supervisor cashiers can ONLY see their own held bills
            return invoiceRepository.findByStatusAndCreatedBy("HELD", getCurrentUsername()).stream()
                    .map(InvoiceDto::from)
                    .collect(Collectors.toList());
        }

        // Supervisor / Admin with SALES_VIEW_ALL
        if (cashier != null && !cashier.isBlank()) {
            return invoiceRepository.findByStatusAndCreatedBy("HELD", cashier.trim()).stream()
                    .map(InvoiceDto::from)
                    .collect(Collectors.toList());
        }

        return invoiceRepository.findByStatus("HELD").stream()
                .map(InvoiceDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceById(Long id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        return InvoiceDto.from(invoice);
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceByNumber(String invoiceNumber) {
        Invoice invoice = invoiceRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        return InvoiceDto.from(invoice);
    }

    @Transactional
    public InvoiceDto createInvoice(CreateInvoiceRequest request) {
        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        Customer customer;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", request.getCustomerId()));
        } else {
            customer = customerRepository.findByCustomerCode("CUST-0001")
                    .orElseGet(() -> customerRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new BusinessException("No default walk-in customer available")));
        }

        User salesman = null;
        if (request.getSalesmanId() != null) {
            salesman = userRepository.findById(request.getSalesmanId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getSalesmanId()));
        } else {
            Long currentUserId = SecurityUtils.getCurrentUserId().orElse(null);
            if (currentUserId != null) {
                salesman = userRepository.findById(currentUserId).orElse(null);
            }
        }

        // Validate staff quota restrictions before processing sale
        if (!request.isHold() && salesman != null) {
            for (CreateInvoiceRequest.CreateInvoiceItemRequest itemReq : request.getItems()) {
                productStaffQuotaService.validateStaffQuota(
                        itemReq.getProductId(),
                        salesman.getId(),
                        warehouse.getId(),
                        itemReq.getQuantity()
                );
            }
        }

        String invoiceNumber = sequenceService.generateInvoiceNumber();
        LocalDate invDate = request.getInvoiceDate() != null ? request.getInvoiceDate() : LocalDate.now();

        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .customer(customer)
                .warehouse(warehouse)
                .salesRep(salesman)
                .status(request.isHold() ? "HELD" : "COMPLETED")
                .paymentType(request.getPaymentType() != null ? request.getPaymentType().toUpperCase() : "CASH")
                .invoiceDate(invDate)
                .notes(request.getNotes())
                .items(new ArrayList<>())
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;

        for (CreateInvoiceRequest.CreateInvoiceItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal catalogPrice = product.getSellingPrice() != null ? product.getSellingPrice() : BigDecimal.ZERO;
            BigDecimal unitPrice = itemReq.getUnitPrice();
            if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                unitPrice = catalogPrice;
            } else if (catalogPrice.compareTo(BigDecimal.ZERO) > 0 && unitPrice.compareTo(catalogPrice) != 0) {
                log.warn("Price mismatch on SKU {}: requested {}, catalog {}. Enforcing catalog selling price.",
                        product.getSku(), unitPrice, catalogPrice);
                unitPrice = catalogPrice;
            }

            BigDecimal lineGross = itemReq.getQuantity().multiply(unitPrice);
            BigDecimal itemDisc = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
            if (itemReq.getDiscountRate() != null && itemReq.getDiscountRate().compareTo(BigDecimal.ZERO) > 0) {
                itemDisc = lineGross.multiply(itemReq.getDiscountRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }

            BigDecimal lineNet = lineGross.subtract(itemDisc);
            if (lineNet.compareTo(BigDecimal.ZERO) < 0) {
                lineNet = BigDecimal.ZERO;
            }
            subtotal = subtotal.add(lineNet);

            InvoiceItem item = InvoiceItem.builder()
                    .invoice(invoice)
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(unitPrice)
                    .costPrice(product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO)
                    .discountRate(itemReq.getDiscountRate() != null ? itemReq.getDiscountRate() : BigDecimal.ZERO)
                    .discountAmount(itemDisc)
                    .totalPrice(lineNet)
                    .build();

            invoice.getItems().add(item);
        }

        BigDecimal invDiscount = request.getDiscountAmount() != null ? request.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal taxable = subtotal.subtract(invDiscount);
        if (taxable.compareTo(BigDecimal.ZERO) < 0) {
            taxable = BigDecimal.ZERO;
        }

        BigDecimal taxRate = request.getTaxRate() != null ? request.getTaxRate() : BigDecimal.ZERO;
        BigDecimal taxAmount = taxable.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal netTotal = taxable.add(taxAmount);

        BigDecimal paid = request.getPaidAmount();
        if (paid == null) {
            paid = "CREDIT".equalsIgnoreCase(request.getPaymentType()) ? BigDecimal.ZERO : netTotal;
        }
        BigDecimal balance = netTotal.subtract(paid);

        invoice.setSubtotal(subtotal);
        invoice.setDiscountAmount(invDiscount);
        invoice.setTaxRate(taxRate);
        invoice.setTaxAmount(taxAmount);
        invoice.setNetTotal(netTotal);
        invoice.setPaidAmount(paid);
        invoice.setBalanceAmount(balance);

        Invoice saved = invoiceRepository.save(invoice);

            // If not hold, immediately deduct inventory via StockService and consume staff quota
        if (!request.isHold()) {
            Long whId = warehouse.getId();
            for (InvoiceItem item : saved.getItems()) {
                stockService.decreaseStock(
                        whId,
                        item.getProduct().getId(),
                        item.getQuantity(),
                        "SALE",
                        saved.getInvoiceNumber(),
                        "Sale to customer " + customer.getName()
                );
            }

            // Consume staff quota if a sales rep is assigned
            if (salesman != null) {
                for (InvoiceItem item : saved.getItems()) {
                    productStaffQuotaService.consumeStaffQuota(
                            item.getProduct().getId(),
                            salesman.getId(),
                            whId,
                            item.getQuantity()
                    );
                }
            }

            // Update customer balance if credit sale
            if (balance.compareTo(BigDecimal.ZERO) > 0 && customer.getCreditLimit() != null && customer.getCreditLimit().compareTo(BigDecimal.ZERO) > 0) {
                customer.setCurrentBalance(customer.getCurrentBalance().add(balance));
                customerRepository.save(customer);
            }

            log.info("Invoice '{}' completed. Net total: {}, Stock deducted.", saved.getInvoiceNumber(), saved.getNetTotal());
        } else {
            log.info("Invoice '{}' saved as HELD cart.", saved.getInvoiceNumber());
        }

        auditLogService.log(
                request.isHold() ? "INVOICE_HOLD" : "INVOICE_CREATE",
                "Invoice",
                saved.getInvoiceNumber(),
                String.format("Invoice %s created for customer '%s' with net total %s (Payment: %s)",
                        saved.getInvoiceNumber(), customer.getName(), saved.getNetTotal(), saved.getPaymentType())
        );

        return InvoiceDto.from(saved);
    }

    @Transactional
    public InvoiceDto resumeHeldInvoice(Long id, CreateInvoiceRequest request) {
        Invoice heldInvoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));

        if (!"HELD".equals(heldInvoice.getStatus())) {
            throw new BusinessException("Invoice " + heldInvoice.getInvoiceNumber() + " is not in HELD status");
        }

        // Ownership check: regular salespersons can ONLY resume their own held carts
        String currentUser = getCurrentUsername();
        if (!canViewAllSales() && heldInvoice.getCreatedBy() != null && !heldInvoice.getCreatedBy().equals(currentUser)) {
            throw new BusinessException("Access denied: You cannot resume a bill placed on hold by another cashier (" + heldInvoice.getCreatedBy() + ")");
        }

        // Remove old held invoice and re-create with final details or update
        invoiceRepository.delete(heldInvoice);
        request.setHold(false);
        return createInvoice(request);
    }

    @Transactional
    public void cancelHeldInvoice(Long id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));

        if (!"HELD".equalsIgnoreCase(invoice.getStatus()) 
                && !"SENT_TO_WAREHOUSE".equalsIgnoreCase(invoice.getStatus()) 
                && !"STOCK_ADJUSTED".equalsIgnoreCase(invoice.getStatus())
                && !"CANCELLED".equalsIgnoreCase(invoice.getStatus())) {
            throw new BusinessException("Only held or in-progress invoices can be cancelled. Completed invoices require Sales Return.");
        }

        // Ownership check: regular salespersons can ONLY cancel their own held carts
        String currentUser = getCurrentUsername();
        if (!canViewAllSales() && invoice.getCreatedBy() != null && !invoice.getCreatedBy().equals(currentUser)) {
            throw new BusinessException("Access denied: You cannot discard a bill placed on hold by another cashier (" + invoice.getCreatedBy() + ")");
        }

        invoice.setStatus("CANCELLED");
        invoiceRepository.save(invoice);
        auditLogService.log(
                "INVOICE_CANCELLED",
                "Invoice",
                invoice.getInvoiceNumber(),
                String.format("Held invoice %s marked as CANCELLED by %s", invoice.getInvoiceNumber(), currentUser)
        );
        log.info("Held invoice {} (ID {}) cancelled successfully.", invoice.getInvoiceNumber(), id);
    }

    public static final Set<String> VALID_STATUSES = InvoiceStatus.NAMES;

    @Transactional
    public void deleteInvoice(Long id) {
        SecurityUtils.enforceNoDelete("Invoice", id);
    }

    @Transactional
    public void deleteInvoiceByNumber(String invoiceNumber) {
        SecurityUtils.enforceNoDelete("Invoice", invoiceNumber);
    }

    @Transactional
    public InvoiceDto voidInvoice(Long id, String reason) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        return performVoidInvoice(invoice, reason);
    }

    @Transactional
    public InvoiceDto voidInvoiceByNumber(String invoiceNumber, String reason) {
        Invoice invoice = invoiceRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        return performVoidInvoice(invoice, reason);
    }

    private InvoiceDto performVoidInvoice(Invoice invoice, String reason) {
        String currentStatus = invoice.getStatus() != null ? invoice.getStatus().toUpperCase() : "COMPLETED";
        if ("VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) {
            throw new BusinessException("Invoice " + invoice.getInvoiceNumber() + " is already " + currentStatus);
        }

        // If invoice was completed/paid/partial and deducted stock, revert stock back to warehouse
        if (!"HELD".equals(currentStatus)) {
            if (invoice.getWarehouse() != null && invoice.getItems() != null) {
                Long whId = invoice.getWarehouse().getId();
                for (InvoiceItem item : invoice.getItems()) {
                    if (item.getProduct() != null && item.getQuantity() != null && item.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                        stockService.increaseStock(
                                whId,
                                item.getProduct().getId(),
                                item.getQuantity(),
                                item.getCostPrice() != null ? item.getCostPrice() : BigDecimal.ZERO,
                                "VOID_SALE",
                                invoice.getInvoiceNumber(),
                                "Stock restored due to voiding of invoice " + invoice.getInvoiceNumber() + (reason != null ? " (" + reason + ")" : "")
                        );

                        // Restore staff quota if invoice had a salesman
                        if (invoice.getSalesman() != null) {
                            productStaffQuotaService.restoreStaffQuota(
                                    item.getProduct().getId(),
                                    invoice.getSalesman().getId(),
                                    whId,
                                    item.getQuantity()
                            );
                        }
                    }
                }
            }

            // Revert customer balance if credit sale
            Customer customer = invoice.getCustomer();
            if (customer != null && invoice.getBalanceAmount() != null && invoice.getBalanceAmount().compareTo(BigDecimal.ZERO) > 0) {
                if (customer.getCurrentBalance() != null) {
                    BigDecimal newBal = customer.getCurrentBalance().subtract(invoice.getBalanceAmount());
                    customer.setCurrentBalance(newBal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newBal);
                    customerRepository.save(customer);
                }
            }
            invoice.setStatus("VOIDED");
        } else {
            invoice.setStatus("CANCELLED");
        }

        String voidInfo = String.format(" [VOIDED on %s by %s: %s]",
                LocalDate.now(), getCurrentUsername(), reason != null && !reason.isBlank() ? reason.trim() : "Manual void");
        invoice.setNotes(invoice.getNotes() != null ? invoice.getNotes() + voidInfo : voidInfo);

        Invoice saved = invoiceRepository.save(invoice);
        log.info("Invoice {} (ID {}) has been VOIDED. Stock and customer balances restored atomically.",
                saved.getInvoiceNumber(), saved.getId());

        auditLogService.log(
                "INVOICE_VOID",
                "Invoice",
                saved.getInvoiceNumber(),
                String.format("Invoice %s voided by %s. Reason: %s",
                        saved.getInvoiceNumber(), getCurrentUsername(), reason != null ? reason : "Manual void")
        );

        return InvoiceDto.from(saved);
    }

    @Transactional
    public InvoiceDto updateInvoice(Long id, UpdateInvoiceRequest request) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        SecurityUtils.enforceCanEdit("SALES", invoice.getInvoiceNumber());
        return performUpdateInvoice(invoice, request);
    }

    @Transactional
    public InvoiceDto updateInvoiceByNumber(String invoiceNumber, UpdateInvoiceRequest request) {
        Invoice invoice = invoiceRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        SecurityUtils.enforceCanEdit("SALES", invoice.getInvoiceNumber());
        return performUpdateInvoice(invoice, request);
    }

    private InvoiceDto performUpdateInvoice(Invoice invoice, UpdateInvoiceRequest request) {
        String currentStatus = invoice.getStatus() != null ? invoice.getStatus().toUpperCase() : "COMPLETED";
        if ("VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) {
            throw new BusinessException("Cannot update invoice " + invoice.getInvoiceNumber() + " with terminal status " + currentStatus);
        }

        String targetStatus = null;
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            targetStatus = request.getStatus().trim().toUpperCase();
            if (!VALID_STATUSES.contains(targetStatus)) {
                throw new BusinessException("Invalid invoice status: " + request.getStatus() + ". Valid statuses are: " + VALID_STATUSES);
            }
            if ("HELD".equals(currentStatus) && "VOIDED".equals(targetStatus)) {
                throw new BusinessException("Held bills cannot be voided; cancel them instead.");
            }
            if (!"HELD".equals(currentStatus) && "HELD".equals(targetStatus)) {
                throw new BusinessException("Finalized invoices cannot be reverted to HELD status.");
            }
            if (!"HELD".equals(currentStatus) && "VOIDED".equals(targetStatus)) {
                return performVoidInvoice(invoice, request.getNotes() != null ? request.getNotes() : "Voided via status update");
            }
        }

        // Customer
        if (request.getCustomerId() != null) {
            customerRepository.findById(request.getCustomerId()).ifPresent(invoice::setCustomer);
        } else if (request.getCustomerName() != null && !request.getCustomerName().isBlank()) {
            List<Customer> matching = customerRepository.searchCustomers(request.getCustomerName().trim());
            if (!matching.isEmpty()) {
                invoice.setCustomer(matching.get(0));
            }
        }

        // Salesman / Sales Rep
        if (request.getSalesmanId() != null) {
            userRepository.findById(request.getSalesmanId()).ifPresent(invoice::setSalesman);
        }

        // Warehouse
        if (request.getWarehouseId() != null) {
            warehouseRepository.findById(request.getWarehouseId()).ifPresent(invoice::setWarehouse);
        }

        // Line Items update: only permitted for HELD invoices
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            if (!"HELD".equals(currentStatus)) {
                throw new BusinessException("Cannot modify line items on finalized invoice (" + currentStatus + "). Void the invoice and create a new one instead.");
            }

            invoice.getItems().clear();
            BigDecimal calculatedSubtotal = BigDecimal.ZERO;

            for (UpdateInvoiceRequest.UpdateInvoiceItemRequest itemReq : request.getItems()) {
                Product product = null;
                if (itemReq.getProductId() != null) {
                    product = productRepository.findById(itemReq.getProductId()).orElse(null);
                } else if (itemReq.getSku() != null && !itemReq.getSku().isBlank()) {
                    product = productRepository.findBySku(itemReq.getSku()).orElse(null);
                }
                if (product == null) continue;

                BigDecimal qty = itemReq.getQuantity() != null && itemReq.getQuantity().compareTo(BigDecimal.ZERO) > 0
                        ? itemReq.getQuantity()
                        : BigDecimal.ONE;
                BigDecimal unitPrice = product.getSellingPrice() != null ? product.getSellingPrice() : BigDecimal.ZERO;

                BigDecimal lineGross = qty.multiply(unitPrice);
                BigDecimal discRate = itemReq.getDiscountRate() != null ? itemReq.getDiscountRate() : BigDecimal.ZERO;
                BigDecimal discAmt = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
                if (discRate.compareTo(BigDecimal.ZERO) > 0 && discAmt.compareTo(BigDecimal.ZERO) == 0) {
                    discAmt = lineGross.multiply(discRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                }

                BigDecimal lineNet = lineGross.subtract(discAmt);
                if (lineNet.compareTo(BigDecimal.ZERO) < 0) lineNet = BigDecimal.ZERO;
                calculatedSubtotal = calculatedSubtotal.add(lineNet);

                InvoiceItem newItem = InvoiceItem.builder()
                        .invoice(invoice)
                        .product(product)
                        .quantity(qty)
                        .unitPrice(unitPrice)
                        .costPrice(product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO)
                        .discountRate(discRate)
                        .discountAmount(discAmt)
                        .totalPrice(lineNet)
                        .build();

                invoice.getItems().add(newItem);
            }

            invoice.setSubtotal(calculatedSubtotal);

            // If finalizing from HELD to COMPLETED/PAID, deduct inventory atomically
            if ("COMPLETED".equals(targetStatus) || "PAID".equals(targetStatus) || "PARTIAL".equals(targetStatus)) {
                Long whId = invoice.getWarehouse() != null ? invoice.getWarehouse().getId() : 1L;
                for (InvoiceItem item : invoice.getItems()) {
                    stockService.decreaseStock(
                            whId,
                            item.getProduct().getId(),
                            item.getQuantity(),
                            "SALE",
                            invoice.getInvoiceNumber(),
                            "Sale finalized from held bill " + invoice.getInvoiceNumber()
                    );
                }
            }
        }

        if (request.getDiscountAmount() != null) {
            invoice.setDiscountAmount(request.getDiscountAmount());
        }
        if (request.getTaxRate() != null) {
            invoice.setTaxRate(request.getTaxRate());
        }
        if (request.getTaxAmount() != null) {
            invoice.setTaxAmount(request.getTaxAmount());
        }

        if ("HELD".equals(currentStatus)) {
            BigDecimal taxable = invoice.getSubtotal().subtract(invoice.getDiscountAmount());
            if (taxable.compareTo(BigDecimal.ZERO) < 0) taxable = BigDecimal.ZERO;
            BigDecimal tax = taxable.multiply(invoice.getTaxRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            invoice.setTaxAmount(tax);
            invoice.setNetTotal(taxable.add(tax));
        } else if (request.getTotalAmount() != null) {
            invoice.setNetTotal(request.getTotalAmount());
        }

        BigDecimal paid = request.getPaidAmount() != null ? request.getPaidAmount() : invoice.getPaidAmount();
        invoice.setPaidAmount(paid);

        BigDecimal balance = request.getBalanceAmount() != null
                ? request.getBalanceAmount()
                : invoice.getNetTotal().subtract(paid);
        if (balance.compareTo(BigDecimal.ZERO) < 0) balance = BigDecimal.ZERO;
        invoice.setBalanceAmount(balance);

        if (targetStatus != null) {
            invoice.setStatus(targetStatus);
        } else if (!"HELD".equals(currentStatus)) {
            if (paid.compareTo(invoice.getNetTotal()) >= 0 && invoice.getNetTotal().compareTo(BigDecimal.ZERO) > 0) {
                invoice.setStatus("PAID");
            } else if (paid.compareTo(BigDecimal.ZERO) > 0) {
                invoice.setStatus("PARTIAL");
            } else {
                invoice.setStatus("COMPLETED");
            }
        }

        if (request.getPaymentType() != null) {
            invoice.setPaymentType(request.getPaymentType().toUpperCase());
        }
        if (request.getInvoiceDate() != null) {
            invoice.setInvoiceDate(request.getInvoiceDate());
        }
        if (request.getNotes() != null) {
            invoice.setNotes(request.getNotes());
        }

        Invoice saved = invoiceRepository.save(invoice);
        auditLogService.log(
                "INVOICE_UPDATE",
                "Invoice",
                saved.getInvoiceNumber(),
                String.format("Invoice %s updated by %s (Status: %s, Net Total: %s)",
                        saved.getInvoiceNumber(), getCurrentUsername(), saved.getStatus(), saved.getNetTotal())
        );
        log.info("Invoice {} (ID {}) updated successfully in DB. Status: {}, Net Total: {}",
                saved.getInvoiceNumber(), saved.getId(), saved.getStatus(), saved.getNetTotal());
        return InvoiceDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<CashierAccountingDto> getCashierAccounting(LocalDate startDate, LocalDate endDate) {
        // 1. Get sales aggregations grouped by cashier
        List<InvoiceRepository.CashierSalesProjection> salesSummary = invoiceRepository.getCashierSalesSummary(startDate, endDate);
        Map<String, InvoiceRepository.CashierSalesProjection> salesMap = salesSummary.stream()
                .filter(p -> p.getCashier() != null)
                .collect(Collectors.toMap(InvoiceRepository.CashierSalesProjection::getCashier, p -> p, (a, b) -> a));

        // 2. Get held aggregations grouped by cashier
        List<InvoiceRepository.CashierHeldProjection> heldSummary = invoiceRepository.getCashierHeldSummary();
        Map<String, InvoiceRepository.CashierHeldProjection> heldMap = heldSummary.stream()
                .filter(p -> p.getCashier() != null)
                .collect(Collectors.toMap(InvoiceRepository.CashierHeldProjection::getCashier, p -> p, (a, b) -> a));

        // 3. Collect all registered users for metadata
        List<User> allUsers = userRepository.findAll();
        Map<String, User> userMap = allUsers.stream()
                .collect(Collectors.toMap(User::getUsername, u -> u, (a, b) -> a));

        // 4. Gather unique cashier usernames from sales, held, and users with cashier/sales/admin roles
        Set<String> allCashierUsernames = new TreeSet<>();
        allCashierUsernames.addAll(salesMap.keySet());
        allCashierUsernames.addAll(heldMap.keySet());
        for (User u : allUsers) {
            boolean hasBillingRole = u.getRoles() != null && u.getRoles().stream().anyMatch(r ->
                    r.getName().contains("SALES") || r.getName().contains("CASHIER") || r.getName().contains("ADMIN")
            );
            if (hasBillingRole) {
                allCashierUsernames.add(u.getUsername());
            }
        }

        List<CashierAccountingDto> result = new ArrayList<>();
        for (String username : allCashierUsernames) {
            User u = userMap.get(username);
            InvoiceRepository.CashierSalesProjection sales = salesMap.get(username);
            InvoiceRepository.CashierHeldProjection held = heldMap.get(username);

            result.add(CashierAccountingDto.builder()
                    .username(username)
                    .fullName(u != null ? u.getFullName() : username)
                    .email(u != null ? u.getEmail() : null)
                    .roles(u != null && u.getRoles() != null
                            ? u.getRoles().stream().map(r -> r.getName()).collect(Collectors.toList())
                            : List.of())
                    .completedInvoicesCount(sales != null && sales.getInvoiceCount() != null ? sales.getInvoiceCount() : 0L)
                    .totalSalesAmount(sales != null && sales.getTotalSales() != null ? sales.getTotalSales() : BigDecimal.ZERO)
                    .heldInvoicesCount(held != null && held.getHeldCount() != null ? held.getHeldCount() : 0L)
                    .totalHeldAmount(held != null && held.getTotalHeld() != null ? held.getTotalHeld() : BigDecimal.ZERO)
                    .lastSaleDate(sales != null ? sales.getLastSaleDate() : null)
                    .build());
        }

        // Sort descending by totalSalesAmount, then heldInvoicesCount
        result.sort((a, b) -> {
            int cmp = b.getTotalSalesAmount().compareTo(a.getTotalSalesAmount());
            if (cmp != 0) return cmp;
            return Long.compare(b.getHeldInvoicesCount(), a.getHeldInvoicesCount());
        });

        return result;
    }
}
