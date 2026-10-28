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
    private static final Set<String> UNPOSTED=Set.of("HELD","YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED");
    private final com.nbh.erp.common.service.IdempotencyService idempotency;
    private final org.springframework.context.ApplicationEventPublisher events;

    private final java.time.Clock businessClock;
    private final InvoiceRepository invoiceRepository;

    private final CustomerRepository customerRepository;
    private final CustomerCreditPolicy creditPolicy;
    private final com.nbh.erp.customer.service.PosCustomerAccess posCustomers;
    private final HeldBillStaff heldStaff;
    private final HeldOriginalsService heldOriginals;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ProductStaffQuotaService productStaffQuotaService;
    private final PosAllocationService posAllocations;
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
        return searchInvoices(warehouseId, customerId, status, paymentType, null, startDate, endDate, cashier, query, pageable);
    }

    @Transactional(readOnly = true)
    public PagedResponse<InvoiceDto> searchInvoices(
            Long warehouseId,
            Long customerId,
            String status,
            String paymentType,
            String paymentMethod,
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

        String effectiveMethod = (paymentMethod != null && !paymentMethod.isBlank() && !"ALL".equalsIgnoreCase(paymentMethod))
                ? paymentMethod.trim().toUpperCase()
                : (paymentType != null && !paymentType.isBlank() && !"ALL".equalsIgnoreCase(paymentType))
                ? paymentType.trim().toUpperCase()
                : null;

        String effectiveStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
                ? status.trim().toUpperCase()
                : null;

        Page<InvoiceDto> page = invoiceRepository
                .searchInvoices(warehouseId, customerId, effectiveStatus, paymentType, effectiveMethod, startDate, endDate, effectiveCashier, query, pageable)
                .map(this::withHeldSources);
        return PagedResponse.from(page);
    }

    private InvoiceDto withHeldSources(Invoice invoice) {
        var dto=InvoiceDto.from(invoice);
        var sources=invoiceRepository.findByMergedInvoiceId(invoice.getId()).stream().filter(b->"MERGED".equals(b.getStatus())).toList();
        dto.setSourceHeldNumbers(sources.stream().map(Invoice::getHeldNumber).toList());
        dto.setSourceHeldBills(sources.stream().map(b->new InvoiceDto.HeldBillSource(b.getId(),b.getHeldNumber(),"VOIDED".equals(invoice.getStatus())?"INVOICE_CANCELLED":"INVOICE_CREATED",b.getNetTotal(),b.getRecordVersion())).toList());
        return dto;
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
    public List<InvoiceDto> getCustomerInvoices(Long customerId, boolean outstandingOnly) {
        List<Invoice> list = outstandingOnly
                ? invoiceRepository.findOutstandingByCustomerId(customerId)
                : invoiceRepository.findByCustomerId(customerId);
        return list.stream()
                .filter(i -> !"HELD".equals(i.getStatus()) && !"CANCELLED".equals(i.getStatus()) && !"VOIDED".equals(i.getStatus()) || !outstandingOnly)
                .sorted(Comparator.comparing(Invoice::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::withHeldSources)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly=true)
    public com.nbh.erp.sales.dto.HeldBillWorkspaceDto heldWorkspace(String scope,String query,Long excludeId) {return heldWorkspace(scope,query,excludeId,false);}

    @Transactional(readOnly=true)
    public com.nbh.erp.sales.dto.HeldBillWorkspaceDto heldWorkspace(String scope,String query,Long excludeId,boolean history) {
        if(!Set.of("mine","others","all").contains(scope))throw new BusinessException("Choose My bills, Other bills or All held bills");
        LocalDate today=LocalDate.now(businessClock),start=today.withDayOfMonth(1),end=today.withDayOfMonth(today.lengthOfMonth());
        String username=getCurrentUsername(),search=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        var rows=invoiceRepository.findByStatusIn(history?Set.of("MERGED","CANCELLED"):Set.of("HELD","YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED","MERGED","CANCELLED")).stream()
            .filter(i->i.getHeldNumber()!=null)
            .filter(i->!Objects.equals(i.getId(),excludeId))
            .filter(i->"all".equals(scope) || "mine".equals(scope)==Objects.equals(i.getCreatedBy(),username))
            .filter(i->search.isBlank() || (i.getDocumentNumber()+" "+i.getCustomer().getName()+" "+(i.getWarehouse()!=null?i.getWarehouse().getName()+" "+i.getWarehouse().getCode():"")+" "+i.getCreatedBy()).toLowerCase(Locale.ROOT).contains(search))
            .sorted(Comparator.comparing(Invoice::getCreatedAt).reversed()).map(i->{var dto=InvoiceDto.from(i);
                populateHeldDetails(i,dto);
                dto.setCanResume(!history && (canViewAllSales() || (SecurityUtils.hasAuthority("SALES_EDIT") && !"HELD".equals(i.getStatus())) || Objects.equals(i.getCreatedBy(),username)));return dto;}).toList();
        heldStaff.enrich(rows);
        long mineCount=0,otherCount=0;BigDecimal mine=BigDecimal.ZERO,others=BigDecimal.ZERO;
        for(var total:invoiceRepository.getMonthlyHeldSummary(start,end,excludeId)){
            if(Objects.equals(total.getCashier(),username)){mineCount+=total.getHeldCount();mine=mine.add(total.getTotalHeld());}
            else{otherCount+=total.getHeldCount();others=others.add(total.getTotalHeld());}
        }
        return new com.nbh.erp.sales.dto.HeldBillWorkspaceDto(rows,start,end,mineCount,mine,otherCount,others,rows.stream().map(InvoiceDto::getNetTotal).reduce(BigDecimal.ZERO,BigDecimal::add));
    }

    public record MergePreview(List<Long> sourceBillIds,List<String> sourceBills,String customerName,
        List<InvoiceDto.InvoiceItemDto> items,BigDecimal totalAmount,String date,Map<Long,Long> expectedVersions,com.nbh.erp.sales.dto.InvoicePacking packing) {}
    @Transactional(readOnly = true)
    public MergePreview previewHeldMerge(List<Long> ids) {
        SecurityUtils.requirePermission("SALES_EDIT");
        if(ids==null || ids.isEmpty() || ids.size()>100 || new HashSet<>(ids).size()!=ids.size())throw new BusinessException("Select 1 to 100 distinct held bills");
        var bills=ids.stream().map(id->invoiceRepository.findById(id).orElseThrow(()->new BusinessException("Unknown held bill"))).toList();
        var first=bills.getFirst();
        for(var bill:bills){enforceAccess(bill);if(!"STOCK_ADJUSTED".equals(bill.getStatus()))throw new BusinessException("Only warehouse-reviewed held bills can be invoiced");
            if(!bill.getCustomer().getId().equals(first.getCustomer().getId()))throw new BusinessException("Select held bills for the same customer");}
        return new MergePreview(ids,bills.stream().map(Invoice::getDocumentNumber).toList(),first.getCustomer().getName(),
            bills.stream().flatMap(b->b.getItems().stream()).map(InvoiceDto.InvoiceItemDto::from).toList(),bills.stream().map(Invoice::getNetTotal).reduce(BigDecimal.ZERO,BigDecimal::add),LocalDate.now(businessClock).toString(),bills.stream().collect(Collectors.toMap(Invoice::getId,Invoice::getRecordVersion)),reviewedPacking(bills));
    }

    private com.nbh.erp.sales.dto.InvoicePacking reviewedPacking(List<Invoice> bills){
        return bills.stream().anyMatch(b->!b.getWarehousePacking().isEmpty())
            ? com.nbh.erp.sales.dto.InvoicePacking.sum(bills.stream().map(com.nbh.erp.sales.dto.InvoicePacking::from).toList()):null;
    }

    private void populateHeldDetails(Invoice invoice,InvoiceDto dto) {
        dto.setPosRemarks(invoice.getOriginalHeldSnapshot()!=null?heldOriginals.read(invoice).getPosRemarks():invoice.getNotes());
        if("MERGED".equals(invoice.getStatus()) && invoice.getMergedInvoiceId()!=null){
            var parent=invoiceRepository.findById(invoice.getMergedInvoiceId()).orElseThrow();
            boolean cancelled=Set.of("VOIDED","CANCELLED").contains(parent.getStatus());
            dto.setStatus(cancelled?"INVOICE_CANCELLED":"INVOICE_CREATED");dto.setInvoiceNumber(parent.getInvoiceNumber());
            if(cancelled && dto.getCancellationReason()==null)dto.setCancellationReason(parent.getCancellationReason());
        }
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceById(Long id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));
        enforceAccess(invoice);
        var dto=withHeldSources(invoice);heldStaff.enrich(dto);
        populateHeldDetails(invoice,dto);
        return dto;
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
        posCustomers.requireAssigned(request.getCustomerId(), request.getDeliveryRouteId());
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
            BigDecimal rate = itemReq.getDiscountRate() != null ? itemReq.getDiscountRate() : BigDecimal.ZERO;
            BigDecimal cashDisc = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;

            if (rate.signum() < 0 || rate.compareTo(BigDecimal.valueOf(20)) > 0) {
                throw new BusinessException("Discount rate must be between 0 and 20%");
            }
            if (cashDisc.signum() < 0) {
                throw new BusinessException("Discount amount cannot be negative");
            }

            BigDecimal rateDisc = BigDecimal.ZERO;
            if (rate.signum() > 0) {
                rateDisc = lineGross.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }

            BigDecimal maxLineDisc = lineGross.multiply(new BigDecimal("0.20")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalLineDisc = rateDisc.add(cashDisc);
            if (totalLineDisc.signum() < 0 || totalLineDisc.compareTo(maxLineDisc.add(new BigDecimal("0.01"))) > 0) {
                // Total discount (% + Rs) cannot exceed 20%
                throw new BusinessException("Total discount cannot exceed 20% of item value (max " + maxLineDisc + ")");
            }

            BigDecimal lineNet = lineGross.subtract(totalLineDisc).setScale(2, RoundingMode.HALF_UP);
            if (lineNet.compareTo(BigDecimal.ZERO) < 0) {
                lineNet = BigDecimal.ZERO;
            }
            subtotal = subtotal.add(lineNet);

            InvoiceItem item = InvoiceItem.builder()
                    .invoice(invoice)
                    .product(product)
                    .warehouse(resolveWarehouse(itemReq.getWarehouseId(), warehouse))
                    .quantity(itemReq.getQuantity())
                    .unitPrice(unitPrice)
                    .costPrice(product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO)
                    .discountRate(rate)
                    .discountAmount(cashDisc)
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
        if(request.isHold())posAllocations.validate(invoice);
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
        posCustomers.requireAssigned(request.getCustomerId(), request.getDeliveryRouteId());
        Invoice invoice=invoiceRepository.findByIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("Invoice","id",id));
        enforceAccess(invoice);
        verifyPosVersion(invoice,request);
        if(!"HELD".equals(invoice.getStatus()))throw new BusinessException("Only held POS bills can be edited");
        if(!Boolean.TRUE.equals(invoice.getStockReserved())){customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();reserveInvoiceStock(invoice);}
        UpdateInvoiceRequest update=new UpdateInvoiceRequest();
        update.setCustomerId(request.getCustomerId());update.setWarehouseId(request.getWarehouseId());update.setNotes(request.getNotes());
        update.setDiscountAmount(request.getDiscountAmount());update.setTaxRate(request.getTaxRate());update.setStatus("HELD");
        update.setItems(request.getItems().stream().map(x->UpdateInvoiceRequest.UpdateInvoiceItemRequest.builder()
          .productId(x.getProductId()).warehouseId(x.getWarehouseId()).quantity(x.getQuantity()).unitPrice(x.getUnitPrice()).discountRate(x.getDiscountRate()).discountAmount(x.getDiscountAmount()).build()).toList());
        InvoiceDto updated=performUpdateInvoice(invoice,update);
        posAllocations.validate(invoice);
        return updated;
    }

    private void verifyPosVersion(Invoice invoice,CreateInvoiceRequest request){
        if(request.getExpectedVersion()!=null && request.getExpectedVersion()!=invoice.getRecordVersion())
            throw new BusinessException("This bill was changed in another session. Reopen it from Held bills before continuing.");
    }

    private Warehouse resolveWarehouse(Long id, Warehouse fallback) {
        Warehouse warehouse=id==null?fallback:warehouseRepository.findById(id).orElseThrow(()->new BusinessException("Unknown warehouse"));
        if(!Boolean.TRUE.equals(warehouse.getIsActive()))throw new BusinessException("Choose an active warehouse");
        return warehouse;
    }
    private record StockKey(Long warehouse,Long product) implements Comparable<StockKey> {
        public int compareTo(StockKey other){int c=warehouse.compareTo(other.warehouse);return c!=0?c:product.compareTo(other.product);}
    }
    private Map<StockKey,BigDecimal> stockQuantities(Invoice invoice){
        Map<StockKey,BigDecimal> quantities=new TreeMap<>();
        for(InvoiceItem item:invoice.getItems())quantities.merge(new StockKey(item.fulfillmentWarehouse().getId(),item.getProduct().getId()),item.getQuantity(),BigDecimal::add);
        return quantities;
    }
    private void reserveInvoiceStock(Invoice invoice){
        if(Boolean.TRUE.equals(invoice.getStockReserved()) || Boolean.TRUE.equals(invoice.getStockDeducted()))return;
        for(var line:stockQuantities(invoice).entrySet())stockService.changeReservation(line.getKey().warehouse(),line.getKey().product(),line.getValue());
        invoice.setStockReserved(true);invoiceRepository.save(invoice);
    }
    private void releaseInvoiceStock(Invoice invoice){
        if(!Boolean.TRUE.equals(invoice.getStockReserved()))return;
        for(var line:stockQuantities(invoice).entrySet())stockService.changeReservation(line.getKey().warehouse(),line.getKey().product(),line.getValue().negate());
        invoice.setStockReserved(false);
    }

    private void restoreReviewedStock(Invoice invoice,String reason){
        if(!Boolean.TRUE.equals(invoice.getStockDeducted()))return;
        for(var item:invoice.getItems())
            stockService.increaseStock(item.fulfillmentWarehouse().getId(),item.getProduct().getId(),item.getQuantity(),item.getCostPrice(),"CANCEL_HELD_SALE",invoice.getHeldNumber(),reason);
        invoice.setStockDeducted(false);
    }

    @Transactional
    public InvoiceDto resumeHeldInvoice(Long id, CreateInvoiceRequest request) {
        Invoice heldInvoice = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", id));

        throw new BusinessException("Use warehouse review and merge to invoice held bills");

    }

    @Transactional
    public void cancelHeldInvoice(Long id) {
        cancelHeldInvoice(id,null,null);
    }
    @Transactional
    public void cancelHeldInvoice(Long id,String reason,Long expectedVersion) {
        // Parent first, like payment/delivery, then source bills. All checks and reversals share this transaction.
        Long parentId=invoiceRepository.findMergedParentId(id);
        Invoice parent=parentId==null?null:invoiceRepository.findByIdForUpdate(parentId).orElseThrow();
        if(parent!=null)invoiceRepository.lockMergedSources(parentId);
        Invoice invoice=invoiceRepository.findByIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("Invoice","id",id));
        if(!Objects.equals(parentId,invoice.getMergedInvoiceId()))throw new BusinessException("This bill was invoiced in another session. Reopen it before cancelling.");
        if(invoice.getOriginalHeldSnapshot()!=null || "MERGED".equals(invoice.getStatus())){
            if(reason==null || reason.isBlank() || reason.trim().length()>1000)throw new BusinessException("Enter a cancellation reason, up to 1000 characters");
            if(expectedVersion==null || expectedVersion!=invoice.getRecordVersion())throw new BusinessException("This bill changed. Reopen it before cancelling.");
        }
        if("CANCELLED".equals(invoice.getStatus()))throw new BusinessException("This Onhold bill is already cancelled");
        if("MERGED".equals(invoice.getStatus())){
            SecurityUtils.requirePermission("SALES_EDIT");
            enforceAccess(invoice);
        } else if(!canViewAllSales() && !SecurityUtils.hasAuthority("SALES_EDIT") && !Objects.equals(invoice.getCreatedBy(),getCurrentUsername()))
            throw new BusinessException("Access denied: You cannot cancel another cashier's bill");



        customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();

        if (!"HELD".equalsIgnoreCase(invoice.getStatus())
                && !"SENT_TO_WAREHOUSE".equalsIgnoreCase(invoice.getStatus())
                && !"YET_TO_PRINT".equalsIgnoreCase(invoice.getStatus())
                && !"STOCK_ADJUSTED".equalsIgnoreCase(invoice.getStatus())
                && !"MERGED".equalsIgnoreCase(invoice.getStatus())) {
            throw new BusinessException("Only held or in-progress invoices can be cancelled. Completed invoices require Sales Return.");
        }

        String currentUser=getCurrentUsername();
        if("MERGED".equals(invoice.getStatus())){removeHeldBillFromInvoice(invoice,parent,reason);invoice.setStockDeducted(false);}
        else restoreReviewedStock(invoice,reason);

        releaseInvoiceStock(invoice);
        invoice.setStatus("CANCELLED");invoice.setBalanceAmount(BigDecimal.ZERO);

        if(reason!=null && !reason.isBlank())invoice.setCancellationReason(reason.trim());
        invoiceRepository.save(invoice);
        events.publishEvent(new HeldPerformanceChanged(invoice.getId()));
        auditLogService.log(
                "INVOICE_CANCELLED",
                "Invoice",
                invoice.getDocumentNumber(),
                String.format("Held invoice %s marked as CANCELLED by %s. Reason: %s", invoice.getDocumentNumber(), currentUser,invoice.getCancellationReason())
        );
        log.info("Held invoice {} (ID {}) cancelled successfully.", invoice.getDocumentNumber(), id);
    }

    private void removeHeldBillFromInvoice(Invoice source,Invoice parent,String reason) {
        if(parent==null || !InvoiceBalances.POSTED.contains(parent.getStatus()))throw new BusinessException("Invoice is already cancelled or is no longer open");
        if(parent.getPaidAmount().signum()>0 || Set.of("PAID","PARTIAL").contains(parent.getStatus()))
            throw new BusinessException("Cannot cancel this bill: invoice is already "+(parent.getBalanceAmount().signum()==0?"paid":"partially paid"));
        if(!"PENDING".equals(parent.getDeliveryStatus()) || parent.getDelivery()!=null){
            String delivery=parent.getDelivery()!=null?parent.getDelivery().getStatus():parent.getDeliveryStatus();
            throw new BusinessException("Cannot cancel this bill: delivery is "+String.valueOf(delivery).replace('_',' ')+". Payment and delivery must both be pending.");
        }
        if(parent.getReturnedAmount().signum()>0)throw new BusinessException("Cannot cancel this bill: invoice already has sales returns");
        List<InvoiceItem> removed=new ArrayList<>();
        for(var original:source.getItems()){
            var match=parent.getItems().stream().filter(i->!removed.contains(i) && sameHeldLine(original,i)).findFirst()
                .orElseThrow(()->new BusinessException("Invoice lines no longer match this held bill. No stock or invoice changes were made."));
            removed.add(match);
        }
        for(var item:removed){
            stockService.increaseStock(item.fulfillmentWarehouse().getId(),item.getProduct().getId(),item.getQuantity(),item.getCostPrice(),"CANCEL_HELD_SALE",source.getHeldNumber(),"Cancelled held bill from invoice "+parent.getInvoiceNumber()+": "+reason);
            if(source.getSalesman()!=null)productStaffQuotaService.restoreStaffQuota(item.getProduct().getId(),source.getSalesman().getId(),item.fulfillmentWarehouse().getId(),item.getQuantity());
        }
        parent.getItems().removeAll(removed);
        parent.setSubtotal(parent.getSubtotal().subtract(source.getSubtotal()));
        parent.setDiscountAmount(parent.getDiscountAmount().subtract(source.getDiscountAmount()));
        parent.setTaxAmount(parent.getTaxAmount().subtract(source.getTaxAmount()));
        parent.setNetTotal(parent.getNetTotal().subtract(source.getNetTotal()));
        parent.setBalanceAmount(parent.getNetTotal());
        if(!source.getWarehousePacking().isEmpty()){
            parent.setPackingBoxes(Math.max(0,parent.getPackingBoxes()-source.getPackingBoxes()));
            parent.setPackingBags(Math.max(0,parent.getPackingBags()-source.getPackingBags()));
            parent.setPackingPBags(Math.max(0,parent.getPackingPBags()-source.getPackingPBags()));
            parent.setPackingOthers(Math.max(0,parent.getPackingOthers()-source.getPackingOthers()));
        }
        if(parent.getItems().isEmpty()){parent.setStatus("VOIDED");parent.setBalanceAmount(BigDecimal.ZERO);new com.nbh.erp.sales.dto.InvoicePacking(0,0,0,0).applyTo(parent);}
        var remaining=invoiceRepository.findByMergedInvoiceId(parent.getId()).stream().filter(b->!b.getId().equals(source.getId()) && "MERGED".equals(b.getStatus())).map(Invoice::getHeldNumber).toList();
        parent.setNotes("Held bills: "+String.join(", ",remaining)+(parent.getNotes()==null?"":parent.getNotes().replaceFirst("^Held bills:[^\\n]*",""))+"\nCancelled "+source.getHeldNumber()+" by "+getCurrentUsername()+": "+reason);
        invoiceRepository.saveAndFlush(parent);
        customerBalances.reconcile(parent.getCustomer().getId());
        auditLogService.log("HELD_REMOVED_FROM_INVOICE","Invoice",parent.getInvoiceNumber(),"Cancelled "+source.getHeldNumber()+"; stock restored and invoice total reduced by "+source.getNetTotal()+". Reason: "+reason);
    }
    private boolean sameHeldLine(InvoiceItem a,InvoiceItem b){
        return Objects.equals(a.getProduct().getId(),b.getProduct().getId()) && Objects.equals(a.fulfillmentWarehouse().getId(),b.fulfillmentWarehouse().getId())
            && a.getQuantity().compareTo(b.getQuantity())==0 && a.getUnitPrice().compareTo(b.getUnitPrice())==0
            && a.getDiscountRate().compareTo(b.getDiscountRate())==0 && a.getDiscountAmount().compareTo(b.getDiscountAmount())==0
            && a.getTotalPrice().compareTo(b.getTotalPrice())==0;
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
        if (!canViewAllSales() && !(SecurityUtils.hasAuthority("SALES_EDIT") && invoice.getHeldNumber()!=null && !"HELD".equals(invoice.getStatus())) && !Objects.equals(invoice.getCreatedBy(), getCurrentUsername()))
            throw new org.springframework.security.access.AccessDeniedException("Invoice belongs to another cashier");
    }
    private InvoiceDto performVoidInvoice(Invoice invoice, String reason) {
        SecurityUtils.requirePermission("SALES_VOID");
        enforceAccess(invoice);
        if (reason == null || reason.isBlank() || reason.trim().length()>1000) throw new BusinessException("Enter a void reason, up to 1000 characters");
        if (invoice.getReturnedAmount().signum() > 0) throw new BusinessException("An invoice with returns cannot be voided");
        if (invoice.getPaidAmount().signum() > 0) throw new BusinessException("Reverse payments or issue a sales return before voiding a paid invoice");
        String currentStatus = invoice.getStatus() != null ? invoice.getStatus().toUpperCase() : "COMPLETED";
        if ("MERGED".equals(currentStatus) || "VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) {
            throw new BusinessException("Invoice " + invoice.getDocumentNumber() + " is already " + currentStatus);
        }

        if(UNPOSTED.contains(currentStatus)){customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();releaseInvoiceStock(invoice);restoreReviewedStock(invoice,reason);}
        if (!UNPOSTED.contains(currentStatus) && !InvoiceBalances.POSTED.contains(currentStatus)) throw new BusinessException("Unsupported invoice state for voiding");
        if (invoice.getDelivery()!=null) throw new BusinessException("Cancel the delivery assignment before voiding");
        customerRepository.findByIdForUpdate(invoice.getCustomer().getId()).orElseThrow();
        if (InvoiceBalances.POSTED.contains(currentStatus)) {
            if (invoice.getWarehouse() != null && invoice.getItems() != null) {
                Long whId = invoice.getWarehouse().getId();
                for (InvoiceItem item : invoice.getItems()) {
                    if (item.getProduct() != null && item.getQuantity() != null && item.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                        stockService.increaseStock(
                                item.fulfillmentWarehouse().getId(),
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
                                    item.fulfillmentWarehouse().getId(),
                                    item.getQuantity()
                            );
                        }
                    }
                }
            }



        // A merged invoice may contain allocations from several staff members.
        for(Invoice source:invoiceRepository.findByMergedInvoiceId(invoice.getId()).stream().filter(b->"MERGED".equals(b.getStatus())).toList()) {
            if(source.getSalesman()!=null)for(var line:stockQuantities(source).entrySet())
                productStaffQuotaService.restoreStaffQuota(line.getKey().product(),source.getSalesman().getId(),line.getKey().warehouse(),line.getValue());
        }
        invoice.setStatus("VOIDED");
        } else {
            invoice.setStatus("CANCELLED");
        }

        String voidInfo = String.format(" [VOIDED on %s by %s: %s]",
                LocalDate.now(), getCurrentUsername(), reason != null && !reason.isBlank() ? reason.trim() : "Manual void");
        invoice.setCancellationReason(reason.trim());
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
        if(request.getExpectedVersion()!=null && request.getExpectedVersion()!=invoice.getRecordVersion())throw new BusinessException("This bill changed. Reopen it before saving.");
        String currentStatus=invoice.getStatus();
        if("HELD".equals(currentStatus))posCustomers.requireAssigned(request.getCustomerId()!=null?request.getCustomerId():invoice.getCustomer().getId());
        if(invoice.getOriginalHeldSnapshot()!=null && UNPOSTED.contains(currentStatus))throw new BusinessException("Saved onhold bills are locked. Use warehouse review or cancel with a reason.");
        if ("MERGED".equals(currentStatus) || "VOIDED".equals(currentStatus) || "CANCELLED".equals(currentStatus)) throw new BusinessException("Terminal invoice cannot be edited");
        String target=request.getStatus()==null ? currentStatus : request.getStatus().toUpperCase();
        if(!target.equals(currentStatus) && Set.of("YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED").contains(target))throw new BusinessException("Use the warehouse review workflow to change this status");
        if(UNPOSTED.contains(currentStatus) && !"HELD".equals(currentStatus) && request.getItems()!=null)throw new BusinessException("Use warehouse review to edit a sent bill");
        if(Set.of("YET_TO_PRINT","SENT_TO_WAREHOUSE","STOCK_ADJUSTED").contains(currentStatus) &&
            (request.getCustomerId()!=null || request.getCustomerName()!=null || request.getWarehouseId()!=null || request.getSalesmanId()!=null ||
             request.getDiscountAmount()!=null || request.getTaxRate()!=null || request.getSubtotal()!=null || request.getTotalAmount()!=null ||
             request.getPaidAmount()!=null || request.getBalanceAmount()!=null || request.getTaxAmount()!=null || request.getPaymentType()!=null || request.getPaymentMethod()!=null || request.getInvoiceDate()!=null))
            throw new BusinessException("Sent and reviewed bill values are locked. Record quantity changes through warehouse review.");
        if(UNPOSTED.contains(currentStatus) && !UNPOSTED.contains(target) && !Set.of("CANCELLED","VOIDED").contains(target))throw new BusinessException("Review stock and create the invoice from held bills");
        if(!"HELD".equals(currentStatus) && "HELD".equals(target))throw new BusinessException("A sent bill cannot return to POS");
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
            if ("CANCELLED".equals(target)) { restoreReviewedStock(invoice,request.getNotes());invoice.setStatus("CANCELLED"); }
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
                        BigDecimal cashDisc=line.getDiscountAmount()==null ? BigDecimal.ZERO : line.getDiscountAmount();
                        if(rate.signum()<0 || rate.compareTo(BigDecimal.valueOf(20))>0) throw new BusinessException("Discount rate must be between 0 and 20%");
                        if(cashDisc.signum()<0) throw new BusinessException("Discount amount cannot be negative");
                        BigDecimal rateDisc=BigDecimal.ZERO;
                        if(rate.signum()>0) rateDisc=gross.multiply(rate).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
                        BigDecimal maxLineDisc=gross.multiply(new BigDecimal("0.20")).setScale(2, RoundingMode.HALF_UP);
                        BigDecimal totalLineDisc=rateDisc.add(cashDisc);
                        if(totalLineDisc.signum()<0 || totalLineDisc.compareTo(maxLineDisc.add(new BigDecimal("0.01")))>0) throw new BusinessException("Total discount cannot exceed 20% of item value (max " + maxLineDisc + ")");
                        invoice.getItems().add(InvoiceItem.builder().invoice(invoice).product(product).warehouse(resolveWarehouse(line.getWarehouseId(),invoice.getWarehouse())).quantity(line.getQuantity())
                          .unitPrice(product.getSellingPrice()).costPrice(product.getCostPrice()).discountRate(rate).discountAmount(cashDisc).totalPrice(gross.subtract(totalLineDisc)).build());
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
    public List<InvoiceDto> completeHeldInvoices(List<Long> ids,Map<Long,Long> expectedVersions){return completeHeldInvoices(ids,expectedVersions,new com.nbh.erp.sales.dto.InvoicePacking(0,0,0,0));}

    @Transactional
    public List<InvoiceDto> completeHeldInvoices(List<Long> ids,Map<Long,Long> expectedVersions,com.nbh.erp.sales.dto.InvoicePacking packing){
        return List.of(mergeHeldBills(ids,expectedVersions,packing));
    }

    /** One transaction owns every source bill, reservation, stock posting and customer balance. */
    @Transactional
    public InvoiceDto mergeHeldBills(List<Long> ids) {return mergeHeldBills(ids,null);}

    private InvoiceDto mergeHeldBills(List<Long> ids,Map<Long,Long> expectedVersions) {
        return mergeHeldBills(ids,expectedVersions,new com.nbh.erp.sales.dto.InvoicePacking(0,0,0,0));
    }
    private InvoiceDto mergeHeldBills(List<Long> ids,Map<Long,Long> expectedVersions,com.nbh.erp.sales.dto.InvoicePacking packing) {
        SecurityUtils.requirePermission("SALES_EDIT");
        if(ids==null || ids.isEmpty() || ids.size()>100 || new HashSet<>(ids).size()!=ids.size())
            throw new BusinessException("Select 1 to 100 distinct held bills");
        List<Invoice> sources=new ArrayList<>();
        for(Long id:ids.stream().sorted().toList()) {
            Invoice source=invoiceRepository.findByIdForUpdate(id).orElseThrow(()->new BusinessException("Unknown held bill"));
            enforceAccess(source);
            if(expectedVersions!=null && !Objects.equals(expectedVersions.get(id),source.getRecordVersion()))throw new BusinessException("A selected held bill changed. Reopen the merge preview before creating the invoice.");
            if(!"STOCK_ADJUSTED".equals(source.getStatus()) || source.getMergedInvoiceId()!=null)
                throw new BusinessException("Only warehouse-reviewed held bills can be invoiced");
            sources.add(source);
        }
        Invoice first=sources.getFirst();
        for(Invoice source:sources) {
            if(!source.getCustomer().getId().equals(first.getCustomer().getId()))throw new BusinessException("Select held bills for the same customer");
            if(source.getTaxRate().compareTo(first.getTaxRate())!=0)throw new BusinessException("Selected held bills must have the same tax rate");
        }
        var combinedPacking=reviewedPacking(sources);
        if(combinedPacking!=null)packing=combinedPacking;
        else {
            if(packing==null)throw new BusinessException("Enter packing quantities before creating the invoice");
            packing.validate();
        }
        customerRepository.findByIdForUpdate(first.getCustomer().getId()).orElseThrow();
        Invoice merged=Invoice.builder().invoiceNumber(sequenceService.generateInvoiceNumber()).customer(first.getCustomer())
            .warehouse(first.getWarehouse()).invoiceDate(LocalDate.now(businessClock)).paymentType("CREDIT").paymentMethod("CREDIT")
            .status("COMPLETED").paidAmount(BigDecimal.ZERO).deliveryStatus("PENDING").taxRate(first.getTaxRate()).items(new ArrayList<>())
            .notes("Held bills: "+sources.stream().map(Invoice::getHeldNumber).collect(Collectors.joining(", "))).build();
        for(Invoice source:sources) {
            releaseInvoiceStock(source);
            // Legacy reviewed bills have not issued stock yet. New reviews already have.
            if(!Boolean.TRUE.equals(source.getStockDeducted())){
                for(var item:source.getItems())
                    stockService.decreaseStock(item.fulfillmentWarehouse().getId(),item.getProduct().getId(),item.getQuantity(),item.getCostPrice(),"SALE",merged.getDocumentNumber(),"Legacy reviewed bill invoiced: "+source.getHeldNumber());
                source.setStockDeducted(true);
            }
            merged.setSubtotal(merged.getSubtotal().add(source.getSubtotal()));
            merged.setDiscountAmount(merged.getDiscountAmount().add(source.getDiscountAmount()));
            merged.setTaxAmount(merged.getTaxAmount().add(source.getTaxAmount()));
            merged.setNetTotal(merged.getNetTotal().add(source.getNetTotal()));
            for(InvoiceItem item:source.getItems()) merged.getItems().add(InvoiceItem.builder().invoice(merged).product(item.getProduct()).warehouse(item.fulfillmentWarehouse())
                .quantity(item.getQuantity()).unitPrice(item.getUnitPrice()).costPrice(item.getCostPrice())
                .discountRate(item.getDiscountRate()).discountAmount(item.getDiscountAmount()).totalPrice(item.getTotalPrice()).build());
            if(source.getSalesman()!=null)for(var line:stockQuantities(source).entrySet())
                productStaffQuotaService.recordHeldStaffQuota(line.getKey().product(),source.getSalesman().getId(),line.getKey().warehouse(),line.getValue());
        }
        merged.setPackingBoxes(packing.boxes());merged.setPackingBags(packing.bags());
        merged.setPackingPBags(packing.pBags());merged.setPackingOthers(packing.others());
        merged.setBalanceAmount(merged.getNetTotal());
        invoiceRepository.saveAndFlush(merged);
        for(Invoice source:sources){source.setStatus("MERGED");source.setMergedInvoiceId(merged.getId());source.setBalanceAmount(BigDecimal.ZERO);invoiceRepository.save(source);}
        merged.setStockDeducted(true);
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
        BigDecimal ownPostedBalance=invoice.getId()!=null && InvoiceBalances.POSTED.contains(invoice.getStatus()) ? invoice.getBalanceAmount() : BigDecimal.ZERO;
        creditPolicy.validate(customer.getId(), invoice.getBalanceAmount(), ownPostedBalance);
        for(InvoiceItem item:invoice.getItems()) {
            if(!Boolean.TRUE.equals(item.fulfillmentWarehouse().getIsActive()))throw new BusinessException("A bill warehouse is inactive");
            item.setCostPrice(item.getProduct().getCostPrice());
        }
        for(var line:stockQuantities(invoice).entrySet()) {
            if(consumeQuota && invoice.getSalesman()!=null) productStaffQuotaService.consumeStaffQuota(line.getKey().product(),invoice.getSalesman().getId(),line.getKey().warehouse(),line.getValue());
            if(!Boolean.TRUE.equals(invoice.getStockDeducted()))stockService.decreaseStock(line.getKey().warehouse(),line.getKey().product(),line.getValue(),"SALE",invoice.getDocumentNumber(),"Invoice completion");
        }
        invoice.setStockDeducted(true);
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
