package com.nbh.erp.grn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.grn.dto.CreateGrnRequest;
import com.nbh.erp.grn.dto.GrnDto;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
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
public class GrnService {

    private final GrnRepository grnRepository;
    private final SupplierRepository supplierRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

    @Transactional(readOnly = true)
    public PagedResponse<GrnDto> searchGrns(
            Long warehouseId,
            Long supplierId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<GrnDto> page = grnRepository.searchGrns(warehouseId, supplierId, status, query, pageable).map(GrnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public GrnDto getGrnById(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        return GrnDto.from(grn);
    }

    @Transactional
    public GrnDto createGrn(CreateGrnRequest request, boolean autoProcess) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", "id", request.getSupplierId()));

        Warehouse warehouse = warehouseRepository.findById(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getWarehouseId()));

        String grnNumber = sequenceService.generateGrnNumber();

        Grn grn = Grn.builder()
                .grnNumber(grnNumber)
                .supplier(supplier)
                .warehouse(warehouse)
                .supplierInvoiceNumber(request.getSupplierInvoiceNumber())
                .receivedDate(request.getReceivedDate())
                .notes(request.getNotes())
                .status("DRAFT")
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        BigDecimal grandTotal = BigDecimal.ZERO;

        for (CreateGrnRequest.CreateGrnItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            BigDecimal totalCost = itemReq.getQuantityReceived().multiply(itemReq.getUnitCost());
            grandTotal = grandTotal.add(totalCost);

            GrnItem item = GrnItem.builder()
                    .grn(grn)
                    .product(product)
                    .quantityReceived(itemReq.getQuantityReceived())
                    .unitCost(itemReq.getUnitCost())
                    .totalCost(totalCost)
                    .notes(itemReq.getNotes())
                    .build();

            grn.getItems().add(item);
        }

        grn.setTotalAmount(grandTotal);
        Grn savedGrn = grnRepository.save(grn);

        if (autoProcess) {
            return processGrnInternal(savedGrn);
        }

        return GrnDto.from(savedGrn);
    }

    @Transactional
    public GrnDto processGrn(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));
        return processGrnInternal(grn);
    }

    private GrnDto processGrnInternal(Grn grn) {
        if ("PROCESSED".equals(grn.getStatus())) {
            throw new BusinessException("GRN " + grn.getGrnNumber() + " is already processed");
        }
        if ("CANCELLED".equals(grn.getStatus())) {
            throw new BusinessException("Cannot process cancelled GRN " + grn.getGrnNumber());
        }

        Long warehouseId = grn.getWarehouse().getId();

        for (GrnItem item : grn.getItems()) {
            stockService.increaseStock(
                    warehouseId,
                    item.getProduct().getId(),
                    item.getQuantityReceived(),
                    item.getUnitCost(),
                    "GRN",
                    grn.getGrnNumber(),
                    "Supplier: " + grn.getSupplier().getName() + " (Inv: " + grn.getSupplierInvoiceNumber() + ")"
            );
        }

        grn.setStatus("PROCESSED");
        Grn updated = grnRepository.save(grn);

        log.info("GRN '{}' processed successfully. Total: {}", grn.getGrnNumber(), grn.getTotalAmount());
        return GrnDto.from(updated);
    }

    @Transactional
    public void cancelGrn(Long id) {
        Grn grn = grnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", id));

        if ("PROCESSED".equals(grn.getStatus())) {
            throw new BusinessException("Processed GRN cannot be cancelled or deleted. Use Purchase Return (PRN) instead.");
        }

        grn.setStatus("CANCELLED");
        grnRepository.save(grn);
    }
}
