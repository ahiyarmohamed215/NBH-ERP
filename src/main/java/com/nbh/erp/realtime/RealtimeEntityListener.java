package com.nbh.erp.realtime;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;
import jakarta.persistence.PostRemove;
import org.springframework.beans.factory.ObjectProvider;

/** Hibernate uses Spring's BeanContainer to inject this listener. Records never enter event payloads. */
public class RealtimeEntityListener {
    private final ObjectProvider<RealtimeChanges> changes;
    public RealtimeEntityListener(ObjectProvider<RealtimeChanges> changes) { this.changes = changes; }

    @PostPersist @PostUpdate @PostRemove
    public void changed(Object entity) {
        String topic = switch (org.hibernate.Hibernate.getClass(entity).getSimpleName()) {
            case "PurchaseOrder", "PurchaseOrderItem" -> "orders";
            case "Supplier" -> "suppliers";
            case "Grn", "GrnItem" -> "grn";
            case "Gtn", "GtnItem" -> "gtn";
            case "PurchaseReturn", "PurchaseReturnItem" -> "prn";
            case "Product", "Brand", "Category", "Warehouse", "StockBalance", "StockMovement", "ProductStaffQuota", "StockAdjustment", "StockAdjustmentItem" -> "inventory";
            case "Invoice", "InvoiceItem" -> "sales";
            case "Quotation", "QuotationItem" -> "quotations";
            case "Payment", "PaymentAllocation", "SupplierPayment" -> "payments";
            case "CreditNote", "CreditAllocation", "SalesReturn", "SalesReturnItem" -> "returns";
            case "Customer", "CustomerGroup" -> "customers";
            case "CustomerTarget", "CustomerTargetTier", "CustomerRangeConfig", "CustomerMonthlySummary" -> "targets";
            case "Delivery", "Vehicle", "DeliveryRoute" -> "delivery";
            case "User" -> "users";
            case "Role", "Permission" -> "roles";
            case "AuditLog" -> "audit";
            default -> null;
        };
        if (topic == null) return;

        String type = null;
        Long productId = null;
        Long warehouseId = null;
        Long invoiceId = null;
        Long grnId = null;
        String owner = null;

        if (entity instanceof com.nbh.erp.product.entity.Product p) {
            type = "PRODUCT_UPDATED";
            productId = p.getId();
            warehouseId = p.getDefaultWarehouse() != null ? p.getDefaultWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.inventory.entity.StockBalance sb) {
            type = "STOCK_UPDATED";
            productId = sb.getProduct() != null ? sb.getProduct().getId() : null;
            warehouseId = sb.getWarehouse() != null ? sb.getWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.stockadjustment.entity.StockAdjustment sa) {
            type = "ADJUSTMENT_UPDATED";
            warehouseId = sa.getWarehouse() != null ? sa.getWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.stockadjustment.entity.StockAdjustmentItem sai) {
            type = "STOCK_UPDATED";
            productId = sai.getProduct() != null ? sai.getProduct().getId() : null;
            warehouseId = sai.getStockAdjustment() != null && sai.getStockAdjustment().getWarehouse() != null
                    ? sai.getStockAdjustment().getWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.sales.entity.Invoice inv) {
            type = "INVOICE_UPDATED";
            invoiceId = inv.getId();
            warehouseId = inv.getWarehouse() != null ? inv.getWarehouse().getId() : null;
            owner = inv.getCreatedBy();
        } else if (entity instanceof com.nbh.erp.sales.entity.InvoiceItem item) {
            type = "INVOICE_UPDATED";
            invoiceId = item.getInvoice() != null ? item.getInvoice().getId() : null;
            productId = item.getProduct() != null ? item.getProduct().getId() : null;
            warehouseId = item.getWarehouse() != null ? item.getWarehouse().getId()
                    : (item.getInvoice() != null && item.getInvoice().getWarehouse() != null ? item.getInvoice().getWarehouse().getId() : null);
            owner = item.getInvoice() != null ? item.getInvoice().getCreatedBy() : null;
        } else if (entity instanceof com.nbh.erp.grn.entity.Grn grn) {
            type = "GRN_UPDATED";
            grnId = grn.getId();
            warehouseId = grn.getWarehouse() != null ? grn.getWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.grn.entity.GrnItem gi) {
            type = "GRN_UPDATED";
            grnId = gi.getGrn() != null ? gi.getGrn().getId() : null;
            productId = gi.getProduct() != null ? gi.getProduct().getId() : null;
            warehouseId = gi.getGrn() != null && gi.getGrn().getWarehouse() != null ? gi.getGrn().getWarehouse().getId() : null;
        } else if (entity instanceof com.nbh.erp.warehouse.entity.Warehouse wh) {
            type = "WAREHOUSE_UPDATED";
            warehouseId = wh.getId();
        } else if (entity instanceof BaseEntity base) {
            owner = base.getCreatedBy();
        }

        changes.getObject().changed(topic, "sales".equals(topic) ? owner : null, type, productId, warehouseId, invoiceId, grnId);
        if (!java.util.Set.of("roles", "users", "audit").contains(topic)) {
            changes.getObject().changed("dashboard", null);
            changes.getObject().changed("reports", null);
        }
    }
}
