package com.nbh.erp.gtn.service;

import com.nbh.erp.common.dto.PagedResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.gtn.dto.CreateGtnRequest;
import com.nbh.erp.gtn.dto.GtnDto;
import com.nbh.erp.gtn.entity.Gtn;
import com.nbh.erp.gtn.entity.GtnItem;
import com.nbh.erp.gtn.repository.GtnRepository;
import com.nbh.erp.inventory.service.StockService;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.repository.ProductRepository;
import com.nbh.erp.sequence.service.DocumentSequenceService;
import com.nbh.erp.warehouse.entity.Warehouse;
import com.nbh.erp.warehouse.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class GtnService {

    private final GtnRepository gtnRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final DocumentSequenceService sequenceService;

    @Transactional(readOnly = true)
    public PagedResponse<GtnDto> searchGtns(
            Long sourceWarehouseId,
            Long destinationWarehouseId,
            String status,
            String query,
            Pageable pageable
    ) {
        Page<GtnDto> page = gtnRepository.searchGtns(sourceWarehouseId, destinationWarehouseId, status, query, pageable)
                .map(GtnDto::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public GtnDto getGtnById(Long id) {
        Gtn gtn = gtnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        return GtnDto.from(gtn);
    }

    @Transactional
    public GtnDto createGtn(CreateGtnRequest request, boolean autoTransfer) {
        if (request.getSourceWarehouseId().equals(request.getDestinationWarehouseId())) {
            throw new BusinessException("Source and destination warehouses cannot be the same");
        }

        Warehouse source = warehouseRepository.findById(request.getSourceWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getSourceWarehouseId()));

        Warehouse destination = warehouseRepository.findById(request.getDestinationWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse", "id", request.getDestinationWarehouseId()));

        String gtnNumber = sequenceService.generateGtnNumber();

        Gtn gtn = Gtn.builder()
                .gtnNumber(gtnNumber)
                .sourceWarehouse(source)
                .destinationWarehouse(destination)
                .dispatchDate(request.getDispatchDate() != null ? request.getDispatchDate() : LocalDate.now())
                .notes(request.getNotes())
                .status("DRAFT")
                .items(new ArrayList<>())
                .build();

        for (CreateGtnRequest.CreateGtnItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", "id", itemReq.getProductId()));

            GtnItem item = GtnItem.builder()
                    .gtn(gtn)
                    .product(product)
                    .quantityTransferred(itemReq.getQuantityTransferred())
                    .unitCost(product.getCostPrice())
                    .notes(itemReq.getNotes())
                    .build();

            gtn.getItems().add(item);
        }

        Gtn saved = gtnRepository.save(gtn);

        if (autoTransfer) {
            return executeTransfer(saved);
        }

        return GtnDto.from(saved);
    }

    @Transactional
    public GtnDto transferGtn(Long id) {
        Gtn gtn = gtnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));
        return executeTransfer(gtn);
    }

    private GtnDto executeTransfer(Gtn gtn) {
        if ("RECEIVED".equals(gtn.getStatus())) {
            throw new BusinessException("GTN " + gtn.getGtnNumber() + " is already completed");
        }
        if ("CANCELLED".equals(gtn.getStatus())) {
            throw new BusinessException("Cannot process cancelled GTN " + gtn.getGtnNumber());
        }

        Long srcWhId = gtn.getSourceWarehouse().getId();
        Long destWhId = gtn.getDestinationWarehouse().getId();

        for (GtnItem item : gtn.getItems()) {
            stockService.transferStock(
                    srcWhId,
                    destWhId,
                    item.getProduct().getId(),
                    item.getQuantityTransferred(),
                    gtn.getGtnNumber(),
                    "Inter-warehouse transfer: " + gtn.getSourceWarehouse().getCode() + " -> " + gtn.getDestinationWarehouse().getCode()
            );
        }

        gtn.setStatus("RECEIVED");
        gtn.setReceiveDate(LocalDate.now());
        Gtn saved = gtnRepository.save(gtn);

        log.info("GTN '{}' executed successfully. Transferred from {} to {}",
                gtn.getGtnNumber(), gtn.getSourceWarehouse().getName(), gtn.getDestinationWarehouse().getName());
        return GtnDto.from(saved);
    }

    @Transactional
    public void cancelGtn(Long id) {
        Gtn gtn = gtnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", id));

        if (!"DRAFT".equals(gtn.getStatus())) {
            throw new BusinessException("Only draft GTNs can be cancelled");
        }

        gtn.setStatus("CANCELLED");
        gtnRepository.save(gtn);
    }
}
