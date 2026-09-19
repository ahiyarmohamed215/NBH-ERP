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

    private final PurchaseReturnRepository purchaseReturnRepository;
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
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        String prnNumber = sequenceService.generatePrnNumber();

        PurchaseReturn prn = PurchaseReturn.builder()
                .prnNumber(prnNumber)
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
            return processPurchaseReturnInternal(saved);
        }

        return PurchaseReturnDto.from(saved);
    }

    @Transactional
    public PurchaseReturnDto processPurchaseReturn(Long id) {
        PurchaseReturn prn = purchaseReturnRepository.findById(id)
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

        Long warehouseId = prn.getWarehouse().getId();

        for (PurchaseReturnItem item : prn.getItems()) {
            stockService.decreaseStock(
                    warehouseId,
                    item.getProduct().getId(),
                    item.getQuantityReturned(),
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
        PurchaseReturn prn = purchaseReturnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Return", "id", id));

        if (!"DRAFT".equals(prn.getStatus())) {
            throw new BusinessException("Only draft purchase returns can be cancelled");
        }

        prn.setStatus("CANCELLED");
        purchaseReturnRepository.save(prn);
    }
}
