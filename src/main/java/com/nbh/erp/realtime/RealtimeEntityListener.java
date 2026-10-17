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
        String owner = entity instanceof com.nbh.erp.sales.entity.InvoiceItem item
                ? item.getInvoice().getCreatedBy() : entity instanceof BaseEntity base ? base.getCreatedBy() : null;
        changes.getObject().changed(topic, "sales".equals(topic) ? owner : null);
        if (!java.util.Set.of("roles", "users", "audit").contains(topic)) {
            changes.getObject().changed("dashboard", null);
            changes.getObject().changed("reports", null);
        }
    }
}
