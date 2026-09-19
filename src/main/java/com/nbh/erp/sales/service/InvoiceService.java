package com.nbh.erp.sales.service;

import com.nbh.erp.common.dto.PagedResponse;
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
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.salesman.entity.Salesman;
import com.nbh.erp.salesman.repository.SalesmanRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
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
    private final SalesmanRepository salesmanRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final UserRepository userRepository;

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
                "ROLE_ADMIN".equals(a.getAuthority()) || "SALES_VIEW_ALL".equals(a.getAuthority())
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

        Salesman salesman = null;
        if (request.getSalesmanId() != null) {
            salesman = salesmanRepository.findById(request.getSalesmanId())
                    .orElseThrow(() -> new ResourceNotFoundException("Salesman", "id", request.getSalesmanId()));
        }

        String invoiceNumber = sequenceService.generateInvoiceNumber();
        LocalDate invDate = request.getInvoiceDate() != null ? request.getInvoiceDate() : LocalDate.now();

        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .customer(customer)
                .warehouse(warehouse)
                .salesman(salesman)
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

            BigDecimal lineGross = itemReq.getQuantity().multiply(itemReq.getUnitPrice());
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
                    .unitPrice(itemReq.getUnitPrice())
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

        // If not hold, immediately deduct inventory via StockService
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

            // Update customer balance if credit sale
            if (balance.compareTo(BigDecimal.ZERO) > 0 && customer.getCreditLimit() != null && customer.getCreditLimit().compareTo(BigDecimal.ZERO) > 0) {
                customer.setCurrentBalance(customer.getCurrentBalance().add(balance));
                customerRepository.save(customer);
            }

            log.info("Invoice '{}' completed. Net total: {}, Stock deducted.", saved.getInvoiceNumber(), saved.getNetTotal());
        } else {
            log.info("Invoice '{}' saved as HELD cart.", saved.getInvoiceNumber());
        }

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

        if (!"HELD".equals(invoice.getStatus())) {
            throw new BusinessException("Only HELD invoices can be cancelled. Completed invoices require Sales Return.");
        }

        // Ownership check: regular salespersons can ONLY cancel their own held carts
        String currentUser = getCurrentUsername();
        if (!canViewAllSales() && invoice.getCreatedBy() != null && !invoice.getCreatedBy().equals(currentUser)) {
            throw new BusinessException("Access denied: You cannot discard a bill placed on hold by another cashier (" + invoice.getCreatedBy() + ")");
        }

        invoice.setStatus("CANCELLED");
        invoiceRepository.save(invoice);
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
