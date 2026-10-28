package com.nbh.erp;

import com.nbh.erp.brand.entity.Brand;
import com.nbh.erp.product.entity.Product;
import com.nbh.erp.product.dto.ProductDto;
import com.nbh.erp.inventory.entity.StockBalance;
import com.nbh.erp.inventory.dto.StockDto;
import com.nbh.erp.warehouse.entity.Warehouse;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class ProductPricingTest {
    private BigDecimal n(String value) {return new BigDecimal(value);}
    @Test void automaticPriceTracksCostAndCurrentProductMarkup() {
        var product=Product.builder().costPrice(n("100")).markupPercent(n("25")).build();
        assertEquals(n("125.00"),product.getSellingPrice());
        product.setUseBrandMarkup(true);product.setSellingPrice(n("120"));
        product.setMarkupPercent(n("30"));assertEquals(n("130.00"),product.getSellingPrice());
        product.setCostPrice(n("200"));assertEquals(n("260.00"),product.getSellingPrice());
    }
    @Test void manualPricesIncludingZeroStayManual() {
        var product=Product.builder().costPrice(n("100")).sellingPrice(n("80")).useBrandMarkup(false).build();
        product.setCostPrice(n("200"));assertEquals(n("80"),product.getSellingPrice());
        product.setSellingPrice(BigDecimal.ZERO);assertEquals(BigDecimal.ZERO,product.getSellingPrice());
        var legacy=Product.builder().costPrice(n("100")).sellingPrice(n("95")).build();
        assertEquals(n("95"),legacy.getSellingPrice());
    }
    @Test void catalogAndInventoryExposeTheSamePriceWithoutExposingHiddenCost() {
        var product=Product.builder().id(1L).costPrice(n("12.3456")).markupPercent(n("12.5")).build();
        var stock=StockBalance.builder().product(product).warehouse(Warehouse.builder().id(1L).build()).quantity(n("2")).reservedQuantity(BigDecimal.ZERO).build();
        assertEquals(n("13.89"),ProductDto.from(product,false).getSellingPrice());
        assertEquals(n("13.89"),StockDto.from(stock,false).getSellingPrice());
        assertNull(ProductDto.from(product,false).getCostPrice());assertNull(StockDto.from(stock,false).getCostPrice());
    }
    @Test void purchasingDocumentsExposeSellingPriceSeparatelyFromPurchaseCost() {
        var product=Product.builder().id(1L).costPrice(n("100")).markupPercent(n("25")).build();
        var warehouse=Warehouse.builder().id(1L).build();
        var supplier=com.nbh.erp.supplier.entity.Supplier.builder().id(1L).name("Supplier").build();
        var returned=org.mockito.Mockito.mock(com.nbh.erp.purchasereturn.entity.PurchaseReturnItem.class);
        org.mockito.Mockito.when(returned.getProduct()).thenReturn(product);
        org.mockito.Mockito.when(returned.getUnitCost()).thenReturn(n("80"));
        org.mockito.Mockito.when(returned.getReturnSupplier()).thenReturn(supplier);
        org.mockito.Mockito.when(returned.getReturnWarehouse()).thenReturn(warehouse);
        var returnDto=com.nbh.erp.purchasereturn.dto.PurchaseReturnDto.PurchaseReturnItemDto.from(returned);
        assertEquals(n("125.00"),returnDto.getSellingPrice());assertEquals(n("80"),returnDto.getUnitCost());
        var ordered=org.mockito.Mockito.mock(com.nbh.erp.purchaseorder.entity.PurchaseOrderItem.class);
        org.mockito.Mockito.when(ordered.getProduct()).thenReturn(product);
        org.mockito.Mockito.when(ordered.getQuantity()).thenReturn(n("2"));
        org.mockito.Mockito.when(ordered.getUnitCost()).thenReturn(n("80"));
        org.mockito.Mockito.when(ordered.getOrderingSupplier()).thenReturn(supplier);
        org.mockito.Mockito.when(ordered.getDeliveryWarehouse()).thenReturn(warehouse);
        var order=org.mockito.Mockito.mock(com.nbh.erp.purchaseorder.entity.PurchaseOrder.class);
        org.mockito.Mockito.when(order.getItems()).thenReturn(java.util.List.of(ordered));
        org.mockito.Mockito.when(order.getSupplier()).thenReturn(supplier);
        org.mockito.Mockito.when(order.getWarehouse()).thenReturn(warehouse);
        var orderLine=com.nbh.erp.purchaseorder.dto.PurchaseOrderDto.from(order).items().getFirst();
        assertEquals(n("125.00"),orderLine.sellingPrice());assertEquals(n("80"),orderLine.unitCost());
    }
}
