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
import com.nbh.erp.sales.dto.CashierSalesSummaryDto;
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
    private static final Set<String> UNPOSTED=Set.of("HELD","SENT_TO_WAREHOUSE","STOCK_ADJUSTED");
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final java.time.Clock businessClock;
    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ProductStaffQuotaService productStaffQuotaService;
    private final com.nbh.erp.customer.service.CustomerBalanceService customerBalances;
    private final com.nbh.erp.payment.repository.PaymentRepository payments;
    private final com.nbh.erp.customerrange.service.CustomerRangeService customerRangeService;

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
            return invoiceRepository.findByStatusInAndCreatedBy(UNPOSTED, getCurrentUsername()).stream()
                    .filter(i -> Boolean.TRUE.equals(i.getCustomer().getIsActive()))
                    .map(InvoiceDto::from)
                    .collect(Collectors.toList());
        }

        // Supervisor / Admin with SALES_VIEW_ALL
        if (cashier != null && !cashier.isBlank()) {
            return invoiceRepository.findByStatusInAndCreatedBy(UNPOSTED, cashier.trim()).stream()
                    .filter(i -> Boolean.TRUE.equals(i.getCustomer().getIsActive()))
                    .map(InvoiceDto::from)
                    .collect(Collectors.toList());
        }

        return invoiceRepository.findByStatusIn(UNPOSTED).stream()
                .filter(i -> Boolean.TRUE.equals(i.getCustomer().getIsActive()))
                .map(InvoiceDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public com.nbh.erp.sales.dto.HeldBillWorkspaceDto heldWorkspace(String scope,String query,Long excludeId) {
        if(!Set.of("mine","others").contains(scope))throw new BusinessException("Choose My bills or Other bills");
        LocalDate today=LocalDate.now(businessClock),start=today.withDayOfMonth(1),end=today.withDayOfMonth(today.lengthOfMonth());
        String username=getCurrentUsername(),search=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        var rows=invoiceRepository.findByStatusIn(UNPOSTED).stream()
            .filter(i->Boolean.TRUE.equals(i.getCustomer().getIsActive()) && !Objects.equals(i.getId(),excludeId))
            .filter(i->"mine".equals(scope)==Objects.equals(i.getCreatedBy(),username))
            .filter(i->search.isBlank() || (i.getDocumentNumber()+" "+i.getCustomer().getName()+" "+i.getCreatedBy()).toLowerCase(Locale.ROOT).contains(search))
            .sorted(Comparator.comparing(Invoice::getCreatedAt).reversed()).map(i->{var dto=InvoiceDto.from(i);dto.setCanResume(canViewAllSales() || Objects.equals(i.getCreatedBy(),username));return dto;}).toList();
        long mineCount=0,otherCount=0;BigDecimal mine=BigDecimal.ZERO,others=BigDecimal.ZERO;
        for(var total:invoiceRepository.getMonthlyHeldSummary(start,end,excludeId)){
            if(Objects.equals(total.getCashier(),username)){mineCount+=total.getHeldCount();mine=mine.add(total.getTotalHeld());}
            else{otherCount+=total.getHeldCount();others=others.add(total.getTotalHeld());}
        }
        return new com.nbh.erp.sales.dto.HeldBillWorkspaceDto(rows,start,end,mineCount,mine,otherCount,others,rows.stream().map(InvoiceDto::getNetTotal).reduce(BigDecimal.ZERO,BigDecimal::add));
    }

    public record MergePreview(List<Long> sourceBillIds,List<String> sourceBills,String customerName,
        List<InvoiceDto.InvoiceItemDto> items,BigDecimal totalAmount,String date,Map<Long,Long> expectedVersions) {}
    @Transactional(readOnly = true)
    public MergePreview previewHeldMerge(List<Long> ids) {
        if(ids==null || ids.isEmpty() || ids.size()>100 || new HashSet<>(ids).size()!=ids.size())throw new BusinessException("Select 1 to 100 distinct held bills");
        var bills=ids.stream().map(id->invoiceRepository.findById(id).orElseThrow(()->new BusinessException("Unknown held bill"))).toList();
        var first=bills.getFirst();
        for(var bill:bills){enforceAccess(bill);if(!UNPOSTED.contains(bill.getStatus()))throw new BusinessException("Only open held bills can be merged");
            if(!bill.getCustomer().getId().equals(first.getCustomer().getId()) || !bill.getWarehouse().getId().equals(first.getWarehouse().getId()))throw new BusinessException("Select held bills for the same customer and warehouse");}
        return new MergePreview(ids,bills.stream().map(Invoice::getDocumentNumber).toList(),first.getCustomer().getName(),
            bills.stream().flatMap(b->b.getItems().stream()).map(InvoiceDto.InvoiceItemDto::from).toList(),bills.stream().map(Invoice::getNetTotal).reduce(BigDecimal.ZERO,BigDecimal::add),LocalDate.now(businessClock).toString(),bills.stream().collect(Collectors.toMap(Invoice::getId,Invoice::getRecordVersion)));
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceById(Long id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        enforceAccess(invoice);
        return InvoiceDto.from(invoice);
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceByNumber(String invoiceNumber) {
        Invoice invoice = invoiceRepository.findByInvoiceNumber(invoiceNumber).or(() -> invoiceRepository.findByHeldNumber(invoiceNumber))
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        enforceAccess(invoice);
        return InvoiceDto.from(invoice);
    }

    @Transactional
    public InvoiceDto createInvoice(CreateInvoiceRequest request) {
        var ticket=idempotency.reserve("createInvoice",request);
        if(ticket!=null && ticket.getResourceId()!=null) return getInvoiceById(ticket.getResourceId());

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        Customer customer;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findByIdForUpdate(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", request.getCustomerId()));
        } else {
            customer = customerRepository.findByCustomerCode("CUST-0001")
                    .orElseThrow(() -> new BusinessException("Configure the walk-in customer CUST-0001 before making cash sales"));
        }

        if (Boolean.FALSE.equals(customer.getIsActive())) {
            throw new BusinessException("Cannot process transaction for inactive customer: " + customer.getName() + " (" + customer.getCustomerCode() + ")");
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

        String invoiceNumber = request.isHold() ? null : sequenceService.generateInvoiceNumber();
        LocalDate invDate = request.getInvoiceDate() != null ? request.getInvoiceDate() : LocalDate.now();

        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .heldNumber(request.isHold() ? sequenceService.getNextNumber("HLD") : null)
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

            if (!Boolean.TRUE.equals(product.getIsActive()) || itemReq.getQuantity()==null || itemReq.getQuantity().signum()<=0) throw new BusinessException("Active product and positive quantity required");
            BigDecimal lineGross = itemReq.getQuantity().multiply(unitPrice);
            BigDecimal itemDisc = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
            if (itemReq.getDiscountRate() != null && itemReq.getDiscountRate().compareTo(BigDecimal.ZERO) > 0) {
                itemDisc = lineGross.multiply(itemReq.getDiscountRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }

            if (itemDisc.signum()<0 || itemDisc.compareTo(lineGross)>0) throw new BusinessException("Invalid discount");
            BigDecimal lineNet = lineGross.subtract(itemDisc).setScale(2,RoundingMode.HALF_UP);
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
        if(invDiscount.signum()<0 || invDiscount.compareTo(subtotal)>0) throw new BusinessException("Invalid invoice discount");
        BigDecimal taxable = subtotal.subtract(invDiscount);
        if (taxable.compareTo(BigDecimal.ZERO) < 0) {
            taxable = BigDecimal.ZERO;
        }

        BigDecimal taxRate = request.getTaxRate() != null ? request.getTaxRate() : BigDecimal.ZERO;
        if(taxRate.signum()<0 || taxRate.compareTo(BigDecimal.valueOf(100))>0) throw new BusinessException("Invalid tax rate");
        BigDecimal taxAmount = taxable.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal netTotal = taxable.add(taxAmount);

        BigDecimal paid = request.isHold() ? BigDecimal.ZERO : request.getPaidAmount();
        if (paid == null) {
            paid = "CREDIT".equalsIgnoreCase(request.getPaymentType()) ? BigDecimal.ZERO : netTotal;
        }
        if (paid.signum() < 0 || paid.compareTo(netTotal) > 0) throw new BusinessException("Paid amount must be between zero and invoice total; record change separately");
        BigDecimal balance = netTotal.subtract(paid);

        invoice.setSubtotal(subtotal);
        invoice.setDiscountAmount(invDiscount);
        invoice.setTaxRate(taxRate);
        invoice.setTaxAmount(taxAmount);
        invoice.setNetTotal(netTotal);
        invoice.setPaidAmount(paid);
        invoice.setBalanceAmount(balance);

        invoice.setPaymentMethod(normalizeMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : request.getPaymentType()));
        Invoice saved = invoiceRepository.save(invoice);

        if (!request.isHold()) finalizeInvoice(saved);
        else if(Boolean.TRUE.equals(request.getReserveStock())) reserveInvoiceStock(saved);

        auditLogService.log(
                request.isHold() ? "INVOICE_HOLD" : "INVOICE_CREATE",
                "Invoice",
                saved.getDocumentNumber(),
                String.format("Invoice %s created for customer '%s' with net total %s (Payment: %s)",
                        saved.getDocumentNumber(), customer.getName(), saved.getNetTotal(), saved.getPaymentType())
        );

        invoiceRepository.flush();
        return idempotency.complete(ticket,saved.getId(),InvoiceDto.from(saved));
    }

    @Transactional
    public InvoiceDto savePosDraft(Long id,CreateInvoiceRequest request) {
        Invoice invoice=invoiceRepository.findByIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("Invoice","id",id));
        enforceAccess(invoice);
        verifyPosVersion(invoice,request);
        if(!"HELD".equals(invoice.getStatus()))throw new BusinessException("Only held POS bills can be edited");
        if(!Boolean.TRUE.equals(invoice.getStockReserved())){customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();reserveInvoiceStock(invoice);}
        UpdateInvoiceRequest update=new UpdateInvoiceRequest();
        update.setCustomerId(request.getCustomerId());update.setWarehouseId(request.getWarehouseId());
        update.setDiscountAmount(request.getDiscountAmount());update.setTaxRate(request.getTaxRate());update.setStatus("HELD");
        update.setItems(request.getItems().stream().map(x->UpdateInvoiceRequest.UpdateInvoiceItemRequest.builder()
          .productId(x.getProductId()).quantity(x.getQuantity()).unitPrice(x.getUnitPrice()).discountRate(x.getDiscountRate()).discountAmount(x.getDiscountAmount()).build()).toList());
        return performUpdateInvoice(invoice,update);
    }

    private void verifyPosVersion(Invoice invoice,CreateInvoiceRequest request){
        if(request.getExpectedVersion()!=null && request.getExpectedVersion()!=invoice.getRecordVersion())
            throw new BusinessException("This bill was changed in another session. Reopen it from Held bills before continuing.");
    }

    private Map<Long,BigDecimal> stockQuantities(Invoice invoice){
        Map<Long,BigDecimal> quantities=new TreeMap<>();
        for(InvoiceItem item:invoice.getItems())quantities.merge(item.getProduct().getId(),item.getQuantity(),BigDecimal::add);
        return quantities;
    }
    private void reserveInvoiceStock(Invoice invoice){
        if(Boolean.TRUE.equals(invoice.getStockReserved()))return;
        for(var line:stockQuantities(invoice).entrySet())stockService.changeReservation(invoice.getWarehouse().getId(),line.getKey(),line.getValue());
        invoice.setStockReserved(true);invoiceRepository.save(invoice);
    }
    private void releaseInvoiceStock(Invoice invoice){
        if(!Boolean.TRUE.equals(invoice.getStockReserved()))return;
        for(var line:stockQuantities(invoice).entrySet())stockService.changeReservation(invoice.getWarehouse().getId(),line.getKey(),line.getValue().negate());
        invoice.setStockReserved(false);
    }

    @Transactional
    public InvoiceDto resumeHeldInvoice(Long id, CreateInvoiceRequest request) {
        Invoice heldInvoice = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));

        verifyPosVersion(heldInvoice,request);
        if (!UNPOSTED.contains(heldInvoice.getStatus())) {
            throw new BusinessException("Invoice " + heldInvoice.getInvoiceNumber() + " is not in HELD status");
        }

        // Ownership check: regular salespersons can ONLY resume their own held carts
        String currentUser = getCurrentUsername();
        if (!canViewAllSales() && heldInvoice.getCreatedBy() != null && !heldInvoice.getCreatedBy().equals(currentUser)) {
            throw new BusinessException("Access denied: You cannot resume a bill placed on hold by another cashier (" + heldInvoice.getCreatedBy() + ")");
        }

        UpdateInvoiceRequest update = new UpdateInvoiceRequest();
        update.setCustomerId(request.getCustomerId()); update.setWarehouseId(request.getWarehouseId());
        update.setSalesmanId(request.getSalesmanId()); update.setPaymentType(request.getPaymentType());
        update.setPaymentMethod(request.getPaymentMethod()); update.setDiscountAmount(request.getDiscountAmount());
        update.setTaxRate(request.getTaxRate()); update.setPaidAmount(request.getPaidAmount());
        update.setInvoiceDate(request.getInvoiceDate()); update.setNotes(request.getNotes()); update.setStatus("COMPLETED");
        update.setItems(request.getItems().stream().map(x -> UpdateInvoiceRequest.UpdateInvoiceItemRequest.builder()
            .productId(x.getProductId()).quantity(x.getQuantity()).unitPrice(x.getUnitPrice())
            .discountAmount(x.getDiscountAmount()).discountRate(x.getDiscountRate()).build()).toList());
        return performUpdateInvoice(heldInvoice, update);
    }

    @Transactional
    public void cancelHeldInvoice(Long id) {
        Invoice invoice = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));

        customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();

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

        releaseInvoiceStock(invoice);
        invoice.setStatus("CANCELLED");
        invoiceRepository.save(invoice);
        auditLogService.log(
                "INVOICE_CANCELLED",
                "Invoice",
                invoice.getDocumentNumber(),
                String.format("Held invoice %s marked as CANCELLED by %s", invoice.getDocumentNumber(), currentUser)
        );
        log.info("Held invoice {} (ID {}) cancelled successfully.", invoice.getDocumentNumber(), id);
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
        Invoice invoice = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        return performVoidInvoice(invoice, reason);
    }

    @Transactional
    public InvoiceDto voidInvoiceByNumber(String invoiceNumber, String reason) {
        Invoice invoice = invoiceRepository.findByNumberForUpdate(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        return performVoidInvoice(invoice, reason);
    }

    public void enforceAccess(Invoice invoice) {
        CustomerRepository.requireActive(invoice.getCustomer());
        if (!canViewAllSales() && !Objects.equals(invoice.getCreatedBy(), getCurrentUsername()))
            throw new org.springframework.security.access.AccessDeniedException("Invoice belongs to another cashier");
    }
    private InvoiceDto performVoidInvoice(Invoice invoice, String reason) {
        SecurityUtils.requirePermission("SALES_VOID");
        enforceAccess(invoice);
        if (reason == null || reason.isBlank()) throw new BusinessException("A void reason is required");
        if (invoice.getReturnedAmount().signum() > 0) throw new BusinessException("An invoice with returns cannot be voided");
        if (invoice.getPaidAmount().signum() > 0) throw new BusinessException("Reverse payments or issue a sales return before voiding a paid invoice");
        String currentStatus = invoice.getStatus() != null ? invoice.getStatus().toUpperCase() : "COMPLETED";
        if ("MERGED".equals(currentStatus) || "VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) {
            throw new BusinessException("Invoice " + invoice.getDocumentNumber() + " is already " + currentStatus);
        }

        if(UNPOSTED.contains(currentStatus)){customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();releaseInvoiceStock(invoice);}
        if (!UNPOSTED.contains(currentStatus) && !InvoiceBalances.POSTED.contains(currentStatus)) throw new BusinessException("Unsupported invoice state for voiding");
        if (invoice.getDelivery()!=null) throw new BusinessException("Cancel the delivery assignment before voiding");
        customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
        if (InvoiceBalances.POSTED.contains(currentStatus)) {
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
                                invoice.getDocumentNumber(),
                                "Stock restored due to voiding of invoice " + invoice.getDocumentNumber() + (reason != null ? " (" + reason + ")" : "")
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



        // A merged invoice may contain allocations from several staff members.
        for(Invoice source:invoiceRepository.findByMergedInvoiceId(invoice.getId())) {
            if(source.getSalesman()!=null)for(var line:stockQuantities(source).entrySet())
                productStaffQuotaService.restoreStaffQuota(line.getKey(),source.getSalesman().getId(),source.getWarehouse().getId(),line.getValue());
        }
        invoice.setStatus("VOIDED");
        } else {
            invoice.setStatus("CANCELLED");
        }

        String voidInfo = String.format(" [VOIDED on %s by %s: %s]",
                LocalDate.now(), getCurrentUsername(), reason != null && !reason.isBlank() ? reason.trim() : "Manual void");
        invoice.setNotes(invoice.getNotes() != null ? invoice.getNotes() + voidInfo : voidInfo);

        invoice.setBalanceAmount(BigDecimal.ZERO);
        Invoice saved = invoiceRepository.save(invoice);
        customerBalances.reconcile(invoice.getCustomer().getId());
        log.info("Invoice {} (ID {}) has been VOIDED. Stock and customer balances restored atomically.",
                saved.getDocumentNumber(), saved.getId());

        auditLogService.log(
                "INVOICE_VOID",
                "Invoice",
                saved.getDocumentNumber(),
                String.format("Invoice %s voided by %s. Reason: %s",
                        saved.getDocumentNumber(), getCurrentUsername(), reason != null ? reason : "Manual void")
        );

        try {
            customerRangeService.onInvoiceVoided(saved);
        } catch (Exception e) {
            log.error("Failed to sync customer range on invoice void for {}: {}", saved.getDocumentNumber(), e.getMessage());
        }

        return InvoiceDto.from(saved);
    }

    @Transactional
    public InvoiceDto updateInvoice(Long id, UpdateInvoiceRequest request) {
        Invoice invoice = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        SecurityUtils.enforceCanEdit("SALES", invoice.getDocumentNumber());
        return performUpdateInvoice(invoice, request);
    }

    @Transactional
    public InvoiceDto updateInvoiceByNumber(String invoiceNumber, UpdateInvoiceRequest request) {
        Invoice invoice = invoiceRepository.findByNumberForUpdate(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "invoiceNumber", invoiceNumber));
        SecurityUtils.enforceCanEdit("SALES", invoice.getDocumentNumber());
        return performUpdateInvoice(invoice, request);
    }

    private InvoiceDto performUpdateInvoice(Invoice invoice, UpdateInvoiceRequest request) {
        enforceAccess(invoice);
        String currentStatus=invoice.getStatus();
        if ("MERGED".equals(currentStatus) || "VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) throw new BusinessException("Terminal invoice cannot be edited");
        String target=request.getStatus()==null ? currentStatus : request.getStatus().toUpperCase();
        if ("MERGED".equals(target)) throw new BusinessException("Use held bill merging to create an invoice");
        if (!VALID_STATUSES.contains(target)) throw new BusinessException("Invalid invoice status");
        if ("VOIDED".equals(target)) return performVoidInvoice(invoice, request.getNotes());
        if (!UNPOSTED.contains(currentStatus)) {
            if (!target.equals(currentStatus) || request.getItems()!=null ||
                (request.getCustomerId()!=null && !request.getCustomerId().equals(invoice.getCustomer().getId())) ||
                request.getCustomerName()!=null ||
                (request.getWarehouseId()!=null && !request.getWarehouseId().equals(invoice.getWarehouse().getId())) ||
                request.getSalesmanId()!=null || different(request.getTotalAmount(),invoice.getNetTotal()) ||
                different(request.getPaidAmount(),invoice.getPaidAmount()) || different(request.getBalanceAmount(),invoice.getBalanceAmount()) ||
                different(request.getDiscountAmount(),invoice.getDiscountAmount()) || different(request.getTaxRate(),invoice.getTaxRate()) ||
                different(request.getTaxAmount(),invoice.getTaxAmount()) ||
                (request.getPaymentMethod()!=null && !normalizeMethod(request.getPaymentMethod()).equals(invoice.getPaymentMethod())) ||
                (request.getPaymentType()!=null && !request.getPaymentType().equalsIgnoreCase(invoice.getPaymentType())) ||
                (request.getInvoiceDate()!=null && !request.getInvoiceDate().equals(invoice.getInvoiceDate())))
                throw new BusinessException("Posted invoice values are immutable. Use payments, returns, or void and reissue.");
        } else {
            customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
            if(request.getCustomerId()!=null && !request.getCustomerId().equals(invoice.getCustomer().getId())) customerRepository.findByIdForUpdate(request.getCustomerId()).orElseThrow();
            boolean wasReserved=Boolean.TRUE.equals(invoice.getStockReserved());
            releaseInvoiceStock(invoice);
            if ("CANCELLED".equals(target)) { invoice.setStatus("CANCELLED"); }
            else {
                if (request.getCustomerId()!=null) invoice.setCustomer(customerRepository.findByIdForUpdate(request.getCustomerId()).orElseThrow(() -> new BusinessException("Unknown customer")));
                if (request.getWarehouseId()!=null) invoice.setWarehouse(warehouseRepository.findById(request.getWarehouseId()).orElseThrow(() -> new BusinessException("Unknown warehouse")));
                if (request.getSalesmanId()!=null) invoice.setSalesman(userRepository.findById(request.getSalesmanId()).orElseThrow(() -> new BusinessException("Unknown staff member")));
                if(request.getItems()!=null) {
                    if(request.getItems().isEmpty()) throw new BusinessException("Invoice requires at least one line");
                    invoice.getItems().clear();
                    for(var line:request.getItems()) {
                        Product product=productRepository.findById(line.getProductId()).orElseThrow(() -> new BusinessException("Unknown product"));
                        if(!Boolean.TRUE.equals(product.getIsActive()) || line.getQuantity()==null || line.getQuantity().signum()<=0) throw new BusinessException("Active product and positive quantity required");
                        BigDecimal gross=product.getSellingPrice().multiply(line.getQuantity());
                        BigDecimal rate=line.getDiscountRate()==null ? BigDecimal.ZERO : line.getDiscountRate();
                        BigDecimal discount=line.getDiscountAmount()==null ? BigDecimal.ZERO : line.getDiscountAmount();
                        if(rate.signum()<0 || rate.compareTo(BigDecimal.valueOf(100))>0) throw new BusinessException("Discount rate must be between 0 and 100");
                        if(rate.signum()>0) discount=gross.multiply(rate).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
                        if(discount.signum()<0 || discount.compareTo(gross)>0) throw new BusinessException("Invalid line discount");
                        invoice.getItems().add(InvoiceItem.builder().invoice(invoice).product(product).quantity(line.getQuantity())
                          .unitPrice(product.getSellingPrice()).costPrice(product.getCostPrice()).discountRate(rate).discountAmount(discount).totalPrice(gross.subtract(discount)).build());
                    }
                }
                invoice.setSubtotal(invoice.getItems().stream().map(InvoiceItem::getTotalPrice).reduce(BigDecimal.ZERO,BigDecimal::add));
                if(request.getDiscountAmount()!=null) invoice.setDiscountAmount(request.getDiscountAmount());
                if(request.getTaxRate()!=null) invoice.setTaxRate(request.getTaxRate());
                if(invoice.getDiscountAmount().signum()<0 || invoice.getDiscountAmount().compareTo(invoice.getSubtotal())>0 || invoice.getTaxRate().signum()<0 || invoice.getTaxRate().compareTo(BigDecimal.valueOf(100))>0) throw new BusinessException("Invalid discount or tax rate");
                BigDecimal taxable=invoice.getSubtotal().subtract(invoice.getDiscountAmount());
                invoice.setTaxAmount(taxable.multiply(invoice.getTaxRate()).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP));
                invoice.setNetTotal(taxable.add(invoice.getTaxAmount()));
                if(request.getPaymentType()!=null) invoice.setPaymentType(request.getPaymentType().toUpperCase());
                invoice.setPaymentMethod(normalizeMethod(request.getPaymentMethod()!=null ? request.getPaymentMethod() : invoice.getPaymentType()));
                invoice.setPaidAmount(UNPOSTED.contains(target) ? BigDecimal.ZERO : request.getPaidAmount()!=null ? request.getPaidAmount() : "CREDIT".equals(invoice.getPaymentType()) ? BigDecimal.ZERO : invoice.getNetTotal());
                if(invoice.getPaidAmount().signum()<0 || invoice.getPaidAmount().compareTo(invoice.getNetTotal())>0) throw new BusinessException("Invalid paid amount");
                invoice.setBalanceAmount(invoice.getNetTotal().subtract(invoice.getPaidAmount()));
                if(UNPOSTED.contains(target)) {invoice.setStatus(target);if(wasReserved)reserveInvoiceStock(invoice);}
                else if(Set.of("COMPLETED","PAID","PARTIAL").contains(target)) finalizeInvoice(invoice);
                else throw new BusinessException("Invalid invoice transition");
            }
        }
        if(request.getNotes()!=null) invoice.setNotes(request.getNotes());
        Invoice saved=invoiceRepository.saveAndFlush(invoice);
        auditLogService.log("INVOICE_UPDATE","Invoice",saved.getDocumentNumber(),"Updated invoice through validated state transition");
        return InvoiceDto.from(saved);
    }
    @Transactional
    public List<InvoiceDto> completeHeldInvoices(List<Long> ids) {
        return completeHeldInvoices(ids,null);
    }

    @Transactional
    public List<InvoiceDto> completeHeldInvoices(List<Long> ids,Map<Long,Long> expectedVersions){return List.of(mergeHeldBills(ids,expectedVersions));}

    /** One transaction owns every source bill, reservation, stock posting and customer balance. */
    @Transactional
    public InvoiceDto mergeHeldBills(List<Long> ids) {return mergeHeldBills(ids,null);}

    private InvoiceDto mergeHeldBills(List<Long> ids,Map<Long,Long> expectedVersions) {
        if(ids==null || ids.isEmpty() || ids.size()>100 || new HashSet<>(ids).size()!=ids.size())
            throw new BusinessException("Select 1 to 100 distinct held bills");
        List<Invoice> sources=new ArrayList<>();
        for(Long id:ids.stream().sorted().toList()) {
            Invoice source=invoiceRepository.findByIdForUpdate(id).orElseThrow(()->new BusinessException("Unknown held bill"));
            enforceAccess(source);
            if(expectedVersions!=null && !Objects.equals(expectedVersions.get(id),source.getRecordVersion()))throw new BusinessException("A selected held bill changed. Reopen the merge preview before creating the invoice.");
            if(!UNPOSTED.contains(source.getStatus()) || source.getMergedInvoiceId()!=null)
                throw new BusinessException("A selected held bill has already been invoiced or cancelled");
            sources.add(source);
        }
        Invoice first=sources.getFirst();
        for(Invoice source:sources) {
            if(!source.getCustomer().getId().equals(first.getCustomer().getId()))throw new BusinessException("Select held bills for the same customer");
            if(!source.getWarehouse().getId().equals(first.getWarehouse().getId()))throw new BusinessException("Select held bills from the same warehouse");
            if(source.getTaxRate().compareTo(first.getTaxRate())!=0)throw new BusinessException("Selected held bills must have the same tax rate");
        }
        customerRepository.findByIdForUpdate(first.getCustomer().getId()).orElseThrow();
        Invoice merged=Invoice.builder().invoiceNumber(sequenceService.generateInvoiceNumber()).customer(first.getCustomer())
            .warehouse(first.getWarehouse()).invoiceDate(LocalDate.now(businessClock)).paymentType("CREDIT").paymentMethod("CREDIT")
            .status("COMPLETED").taxRate(first.getTaxRate()).items(new ArrayList<>())
            .notes("Held bills: "+sources.stream().map(Invoice::getHeldNumber).collect(Collectors.joining(", "))).build();
        for(Invoice source:sources) {
            releaseInvoiceStock(source);
            merged.setSubtotal(merged.getSubtotal().add(source.getSubtotal()));
            merged.setDiscountAmount(merged.getDiscountAmount().add(source.getDiscountAmount()));
            merged.setTaxAmount(merged.getTaxAmount().add(source.getTaxAmount()));
            merged.setNetTotal(merged.getNetTotal().add(source.getNetTotal()));
            for(InvoiceItem item:source.getItems()) merged.getItems().add(InvoiceItem.builder().invoice(merged).product(item.getProduct())
                .quantity(item.getQuantity()).unitPrice(item.getUnitPrice()).costPrice(item.getCostPrice())
                .discountRate(item.getDiscountRate()).discountAmount(item.getDiscountAmount()).totalPrice(item.getTotalPrice()).build());
            if(source.getSalesman()!=null)for(var line:stockQuantities(source).entrySet())
                productStaffQuotaService.consumeStaffQuota(line.getKey(),source.getSalesman().getId(),source.getWarehouse().getId(),line.getValue());
        }
        merged.setBalanceAmount(merged.getNetTotal());
        invoiceRepository.saveAndFlush(merged);
        for(Invoice source:sources){source.setStatus("MERGED");source.setMergedInvoiceId(merged.getId());source.setBalanceAmount(BigDecimal.ZERO);invoiceRepository.save(source);}
        finalizeInvoice(merged,false);
        invoiceRepository.flush();
        auditLogService.log("HELD_BILLS_MERGED","Invoice",merged.getInvoiceNumber(),merged.getNotes());
        return InvoiceDto.from(merged);
    }

    private static boolean different(BigDecimal a,BigDecimal b) { return a!=null && a.compareTo(b)!=0; }
    private static String normalizeMethod(String method) {
        String value=method==null ? "CASH" : method.toUpperCase().replace(' ','_');
        if("CREDIT".equals(value)) return "CREDIT";
        if(!Set.of("CASH","CARD","BANK_TRANSFER","CHEQUE","ONLINE").contains(value)) throw new BusinessException("Invalid payment method");
        return value;
    }
    private void finalizeInvoice(Invoice invoice) { finalizeInvoice(invoice,true); }
    private void finalizeInvoice(Invoice invoice,boolean consumeQuota) {
        if(invoice.getInvoiceNumber()==null)invoice.setInvoiceNumber(sequenceService.generateInvoiceNumber());
        releaseInvoiceStock(invoice);
        if(!Boolean.TRUE.equals(invoice.getWarehouse().getIsActive()) || !Boolean.TRUE.equals(invoice.getCustomer().getIsActive())) throw new BusinessException("Warehouse and customer must be active");
        Customer customer=customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
        BigDecimal outstanding=invoiceRepository.outstandingForCustomer(customer.getId());
        // New invoices may already be saved in the transaction, exclude their own balance once.
        if(invoice.getId()!=null && InvoiceBalances.POSTED.contains(invoice.getStatus())) outstanding=outstanding.subtract(invoice.getBalanceAmount()).max(BigDecimal.ZERO);
        if(invoice.getBalanceAmount().signum()>0 && (customer.getCreditLimit()==null || outstanding.add(invoice.getBalanceAmount()).compareTo(customer.getCreditLimit())>0)) throw new BusinessException("Customer credit limit exceeded (zero means no credit)");
        for(InvoiceItem item:invoice.getItems()) item.setCostPrice(item.getProduct().getCostPrice());
        Map<Long,BigDecimal> quantities=new TreeMap<>();
        for(InvoiceItem item:invoice.getItems()) quantities.merge(item.getProduct().getId(),item.getQuantity(),BigDecimal::add);
        for(var line:quantities.entrySet()) {
            if(consumeQuota && invoice.getSalesman()!=null) productStaffQuotaService.consumeStaffQuota(line.getKey(),invoice.getSalesman().getId(),invoice.getWarehouse().getId(),line.getValue());
            stockService.decreaseStock(invoice.getWarehouse().getId(),line.getKey(),line.getValue(),"SALE",invoice.getDocumentNumber(),"Invoice completion");
        }
        InvoiceBalances.recalculate(invoice);
        invoiceRepository.save(invoice);
        customerBalances.reconcile(customer.getId());


        if(invoice.getPaidAmount().signum()>0) {
            var receipt=com.nbh.erp.payment.entity.Payment.builder().paymentNumber(sequenceService.generatePaymentNumber()).invoice(invoice).customer(customer)
                .amount(invoice.getPaidAmount()).paymentMethod(invoice.getPaymentMethod()).paymentType("INVOICE_PAYMENT").paymentDate(invoice.getInvoiceDate()).status("COMPLETED").notes("Initial invoice payment").build();
            payments.save(receipt);

        }

        try {
            customerRangeService.onInvoiceFinalized(invoice);
        } catch (Exception e) {
            log.error("Failed to sync customer monthly range on invoice finalization for {}: {}", invoice.getDocumentNumber(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<CashierSalesSummaryDto> getCashierSalesSummary(LocalDate startDate, LocalDate endDate) {
        LocalDate month=LocalDate.now(businessClock);
        if(startDate==null)startDate=month.withDayOfMonth(1);
        if(endDate==null)endDate=month.withDayOfMonth(month.lengthOfMonth());
        if(endDate.isBefore(startDate))throw new BusinessException("End date must follow start date");
        // 1. Get sales aggregations grouped by cashier
        List<InvoiceRepository.CashierSalesProjection> salesSummary = invoiceRepository.getCashierSalesSummary(startDate, endDate);
        Map<String, InvoiceRepository.CashierSalesProjection> salesMap = salesSummary.stream()
                .filter(p -> p.getCashier() != null)
                .collect(Collectors.toMap(InvoiceRepository.CashierSalesProjection::getCashier, p -> p, (a, b) -> a));

        // 2. Get held aggregations grouped by cashier
        List<InvoiceRepository.CashierHeldProjection> heldSummary = invoiceRepository.getMonthlyHeldSummary(startDate,endDate,null);
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

        List<CashierSalesSummaryDto> result = new ArrayList<>();
        for (String username : allCashierUsernames) {
            User u = userMap.get(username);
            InvoiceRepository.CashierSalesProjection sales = salesMap.get(username);
            InvoiceRepository.CashierHeldProjection held = heldMap.get(username);

            result.add(CashierSalesSummaryDto.builder()
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
                    .averageHeldAmount(held!=null && held.getHeldCount()!=null && held.getHeldCount()>0 ? held.getTotalHeld().divide(BigDecimal.valueOf(held.getHeldCount()),2,RoundingMode.HALF_UP) : BigDecimal.ZERO)
                    .lastSaleDate(sales != null ? sales.getLastSaleDate() : null)
                    .periodStart(startDate).periodEnd(endDate)
                    .build());
        }

        // Sort descending by totalSalesAmount, then heldInvoicesCount
        result.sort((a, b) -> {
            int cmp = b.getTotalSalesAmount().compareTo(a.getTotalSalesAmount());
            if (cmp != 0) return cmp;
            return Long.compare(b.getHeldInvoicesCount(), a.getHeldInvoicesCount());
        });

        if(!canViewAllSales())result.removeIf(row->!row.getUsername().equals(getCurrentUsername()));
        return result;
    }
}
