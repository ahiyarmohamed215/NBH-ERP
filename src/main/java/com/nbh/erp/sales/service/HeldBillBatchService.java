package com.nbh.erp.sales.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.service.IdempotencyService;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** One POS submission becomes independent, warehouse-specific review bills atomically. */
@Service
@RequiredArgsConstructor
public class HeldBillBatchService {
    public static final int MAX_PRODUCTS = 18;
    private final InvoiceService invoiceService;
    private final InvoiceRepository invoices;
    private final HeldWarehouseWorkflow workflow;
    private final HeldOriginalsService originals;
    private final DocumentSequenceService sequences;
    private final IdempotencyService idempotency;

    public record SaveRequest(Long draftId, @NotNull @Valid CreateInvoiceRequest bill) {}

    @Transactional
    public List<InvoiceDto> save(SaveRequest request) {
        if (!request.bill().isHold()) throw new BusinessException("This action only saves onhold bills");
        var ticket = idempotency.reserve("saveSplitHeld", request);
        if (ticket != null && ticket.getResourceId() != null) {
            var saved = invoices.findByHeldBatchIdOrderByIdAsc(ticket.getResourceId());
            saved.forEach(workflow::access);
            return saved.stream().map(originals::read).toList();
        }
        InvoiceDto draft = request.draftId() == null ? invoiceService.createInvoice(request.bill())
                : invoiceService.savePosDraft(request.draftId(), request.bill());
        Invoice source = invoices.findByIdForUpdate(draft.getId()).orElseThrow();
        if (!"HELD".equals(source.getStatus()) || source.getOriginalHeldSnapshot() != null)
            throw new BusinessException("Only an unsent POS draft can be split");

        Map<Long, List<InvoiceItem>> warehouses = new LinkedHashMap<>();
        for (var item : source.getItems())
            warehouses.computeIfAbsent(item.fulfillmentWarehouse().getId(), key -> new ArrayList<>()).add(item);
        List<List<InvoiceItem>> chunks = new ArrayList<>();
        for (var lines : warehouses.values())
            for (int start = 0; start < lines.size(); start += MAX_PRODUCTS)
                chunks.add(new ArrayList<>(lines.subList(start, Math.min(start + MAX_PRODUCTS, lines.size()))));
        if (chunks.isEmpty()) throw new BusinessException("Add products before saving an onhold bill");

        List<BigDecimal> subtotals = chunks.stream().map(lines -> lines.stream().map(InvoiceItem::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add)).toList();
        List<BigDecimal> discounts = allocate(source.getDiscountAmount(), subtotals);
        List<BigDecimal> taxable = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) taxable.add(subtotals.get(i).subtract(discounts.get(i)));
        List<BigDecimal> taxes = allocate(source.getTaxAmount(), taxable);
        List<Invoice> bills = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            var lines = chunks.get(i);
            Invoice bill;
            if (i == 0) {
                bill = source;
                bill.getItems().removeIf(item -> !lines.contains(item));
            } else {
                bill = Invoice.builder().heldNumber(sequences.getNextNumber("HLD"))
                        .customer(source.getCustomer()).warehouse(lines.getFirst().fulfillmentWarehouse())
                        .salesRep(source.getSalesRep()).status("HELD").paymentType(source.getPaymentType())
                        .paymentMethod(source.getPaymentMethod()).invoiceDate(source.getInvoiceDate()).notes(source.getNotes())
                        .taxRate(source.getTaxRate()).stockReserved(source.getStockReserved()).items(new ArrayList<>()).build();
                for (var item : lines) bill.getItems().add(InvoiceItem.builder().invoice(bill)
                        .product(item.getProduct()).warehouse(item.fulfillmentWarehouse()).quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice()).costPrice(item.getCostPrice()).discountRate(item.getDiscountRate())
                        .discountAmount(item.getDiscountAmount()).totalPrice(item.getTotalPrice()).build());
            }
            bill.setWarehouse(lines.getFirst().fulfillmentWarehouse());
            bill.setHeldBatchId(source.getId());
            bill.setSubtotal(subtotals.get(i));
            bill.setDiscountAmount(discounts.get(i));
            bill.setTaxAmount(taxes.get(i));
            bill.setNetTotal(taxable.get(i).add(taxes.get(i)));
            bill.setPaidAmount(BigDecimal.ZERO);
            bill.setBalanceAmount(bill.getNetTotal());
            bills.add(bill);
        }
        // Reservations already cover the whole submission. Moving lines must not reserve stock twice.
        invoices.saveAllAndFlush(bills);
        List<InvoiceDto> result = new ArrayList<>();
        for (var bill : bills) result.add(workflow.send(bill.getId(),
                new HeldWarehouseWorkflow.SendRequest(bill.getRecordVersion(), null, true)));
        return idempotency.complete(ticket, source.getId(), result);
    }

    /** Cumulative rounding keeps the exact original amount, including the final cent. */
    private List<BigDecimal> allocate(BigDecimal amount, List<BigDecimal> weights) {
        BigDecimal total = weights.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cumulative = BigDecimal.ZERO, allocated = BigDecimal.ZERO;
        List<BigDecimal> result = new ArrayList<>();
        for (int i = 0; i < weights.size(); i++) {
            cumulative = cumulative.add(weights.get(i));
            BigDecimal target = i == weights.size() - 1 ? amount : total.signum() == 0 ? BigDecimal.ZERO
                    : amount.multiply(cumulative).divide(total, 2, RoundingMode.HALF_UP);
            result.add(target.subtract(allocated));
            allocated = target;
        }
        return result;
    }
}
