package com.nbh.erp.purchasereturn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.purchasereturn.dto.CreatePurchaseReturnRequest;
import com.nbh.erp.purchasereturn.dto.PurchaseReturnDto;
import com.nbh.erp.purchasereturn.entity.PurchaseReturn;
import com.nbh.erp.purchasereturn.entity.PurchaseReturnItem;
import com.nbh.erp.purchasereturn.repository.PurchaseReturnRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.supplier.entity.Supplier;
import com.nbh.erp.supplier.repository.SupplierRepository;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class PurchaseReturnService {
    private final com.nbh.erp.common.service.IdempotencyService idempotency;

    private final PurchaseReturnRepository purchaseReturnRepository;
    private final com.nbh.erp.grn.repository.GrnRepository receipts;
    private final com.nbh.erp.payment.repository.SupplierPaymentRepository supplierPayments;
    private final SupplierRepository supplierRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

    @Transactional(readOnly = true)
    public PagedResponse<PurchaseReturnDto> searchPurchaseReturns(
            Long warehouseId,
            Long supplierId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<PurchaseReturnDto> page = purchaseReturnRepository
                .searchPurchaseReturns(warehouseId, supplierId, status, query, pageable)
                .map(PurchaseReturnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public PurchaseReturnDto getPurchaseReturnById(Long id) {
        PurchaseReturn prn = purchaseReturnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));
        return PurchaseReturnDto.from(prn);
    }

    @Transactional
    public PurchaseReturnDto createPurchaseReturn(CreatePurchaseReturnRequest request, boolean autoProcess) {
        var ticket=idempotency.reserve("createPurchaseReturn", request.toString()+"|"+autoProcess);
        if(ticket!=null && ticket.getResourceId()!=null) return getPurchaseReturnById(ticket.getResourceId());

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        String prnNumber = sequenceService.generatePrnNumber();

        PurchaseReturn prn = PurchaseReturn.builder()
                .prnNumber(prnNumber)
                .sourceGrnId(request.getSourceGrnId())
                .supplier(supplier)
                .warehouse(warehouse)
                .returnDate(request.getReturnDate())
                .reason(request.getReason())
                .status("DRAFT")
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (CreatePurchaseReturnRequest.CreatePurchaseReturnItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal totalCost = itemReq.getQuantityReturned().multiply(itemReq.getUnitCost());
            total = total.add(totalCost);

            PurchaseReturnItem item = PurchaseReturnItem.builder()
                    .purchaseReturn(prn)
                    .product(product)
                    .quantityReturned(itemReq.getQuantityReturned())
                    .unitCost(itemReq.getUnitCost())
                    .totalCost(totalCost)
                    .reason(itemReq.getReason())
                    .build();

            prn.getItems().add(item);
        }

        prn.setTotalAmount(total);
        PurchaseReturn saved = purchaseReturnRepository.save(prn);

        if (autoProcess) {
            return idempotency.complete(ticket,saved.getId(),processPurchaseReturnInternal(saved));
        }

        return idempotency.complete(ticket,saved.getId(),PurchaseReturnDto.from(saved));
    }

    @Transactional
    public PurchaseReturnDto processPurchaseReturn(Long id) {
        PurchaseReturn prn = purchaseReturnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));
        return processPurchaseReturnInternal(prn);
    }

    private PurchaseReturnDto processPurchaseReturnInternal(PurchaseReturn prn) {
        if ("PROCESSED".equals(prn.getStatus())) {
            throw new BusinessException("PRN " + prn.getPrnNumber() + " is already processed");
        }
        if ("CANCELLED".equals(prn.getStatus())) {
            throw new BusinessException("Cannot process cancelled PRN " + prn.getPrnNumber());
        }

        if(prn.getSourceGrnId()==null) throw new BusinessException("Link an original GRN before processing");
        var grn=receipts.findByIdForUpdate(prn.getSourceGrnId()).orElseThrow(() -> new BusinessException("Unknown GRN"));
        if(!"PROCESSED".equals(grn.getStatus()) || !grn.getSupplier().getId().equals(prn.getSupplier().getId()) || !grn.getWarehouse().getId().equals(prn.getWarehouse().getId())) throw new BusinessException("Return must match processed GRN supplier and warehouse");
        var seen=new java.util.HashSet<Long>(); BigDecimal total=BigDecimal.ZERO;
        for(var item:prn.getItems()) {
            if(!seen.add(item.getProduct().getId())) throw new BusinessException("Duplicate return product");
            var originals=grn.getItems().stream().filter(i -> i.getProduct().getId().equals(item.getProduct().getId())).toList();
            BigDecimal originalQty=originals.stream().map(com.nbh.erp.grn.entity.GrnItem::getQuantityReceived).reduce(BigDecimal.ZERO,BigDecimal::add);
            BigDecimal returned=purchaseReturnRepository.returnedQuantity(grn.getId(),item.getProduct().getId());
            if(returned.add(item.getQuantityReturned()).compareTo(originalQty)>0) throw new BusinessException("Return exceeds original unreturned receipt");
            BigDecimal cost=originals.stream().map(com.nbh.erp.grn.entity.GrnItem::getTotalCost).reduce(BigDecimal.ZERO,BigDecimal::add).divide(originalQty,6,java.math.RoundingMode.HALF_UP);
            item.setUnitCost(cost);item.setTotalCost(cost.multiply(item.getQuantityReturned()).setScale(2,java.math.RoundingMode.HALF_UP));total=total.add(item.getTotalCost());
        }
        if(total.compareTo(grn.getTotalAmount().subtract(purchaseReturnRepository.totalReturned(grn.getId())).subtract(supplierPayments.totalPaid(grn.getId())))>0) throw new BusinessException("Reverse supplier payment before returning paid goods");
        prn.setTotalAmount(total);
        Long warehouseId = prn.getWarehouse().getId();

        for (PurchaseReturnItem item : prn.getItems()) {
            stockService.decreaseStock(
                    warehouseId,
                    item.getProduct().getId(),
                    item.getQuantityReturned(),
                    item.getUnitCost(),
                    "PRN",
                    prn.getPrnNumber(),
                    "Returned to supplier: " + prn.getSupplier().getName() + " (Reason: " + prn.getReason() + ")"
            );
        }

        prn.setStatus("PROCESSED");
        PurchaseReturn updated = purchaseReturnRepository.save(prn);

        log.info("Purchase Return '{}' processed successfully. Total: {}", prn.getPrnNumber(), prn.getTotalAmount());
        return PurchaseReturnDto.from(updated);
    }

    @Transactional
    public void cancelPurchaseReturn(Long id) {
        PurchaseReturn prn = purchaseReturnRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));

        if (!"DRAFT".equals(prn.getStatus())) {
            throw new BusinessException("Only draft purchase returns can be cancelled");
        }

        prn.setStatus("CANCELLED");
        purchaseReturnRepository.save(prn);
    }
}
