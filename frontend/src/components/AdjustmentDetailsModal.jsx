import React from 'react';
import { Edit2, RotateCcw, CheckCircle, Warehouse, Calendar, MessageSquare } from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';
import { adjustmentStatus, adjustmentQuantity, printStockAdjustment } from '../utils/stockAdjustmentPresentation';
import './PurchaseInspectionModal.css';

export default function AdjustmentDetailsModal({ record, onClose, onEdit, onCancel, onAdjust, busy, canManage }) {
  const status = adjustmentStatus(record);
  const signedQuantity = adjustmentQuantity(record);
  const items = record.items && record.items.length > 0 ? record.items : [record];

  const actions = [];
  if (canManage && status === 'DRAFT' && !record.sourceHeldBillId) {
    if (onEdit) actions.push({ label: 'Edit Adjustment', icon: Edit2, onClick: onEdit, disabled: busy });
    if (onAdjust) {
      actions.push({ label: 'Adjust stock', icon: CheckCircle, onClick: onAdjust, disabled: busy, tone: 'success' });
    }
    if (onCancel) {
      actions.push({ label: 'Cancel adjustment', icon: RotateCcw, onClick: onCancel, disabled: busy, tone: 'danger' });
    }
  }

  return (
    <PurchaseInspectionModal
      type="Adjustment"
      ariaLabel="Stock adjustment details"
      closeAriaLabel="Close stock adjustment details"
      number={record.recordNo || (record.id ? `ADJ-${record.id}` : '—')}
      status={status}
      rows={items}
      detailActions={actions}
      onPrint={() => printStockAdjustment(record)}
      onClose={onClose}
      tableToolbar
      tablePrint={true}
      tableSearchPlaceholder="Search product code, name, warehouse or reason..."
      actionsPosition="bottom"
      detailsPosition="header"
      showHeaderClose
      closeLabel="Close"
      details={[
        { label: 'Record number', value: record.recordNo || (record.id ? `ADJ-${record.id}` : '—') },
        { label: 'Quantity adjusted', value: signedQuantity },
        { label: 'Adjustment type', value: record.type || (Number(record.quantity || 0) >= 0 ? 'Addition' : 'Reduction') },
        { label: 'Warehouse', value: record.warehouse || record.warehouseName || record.items?.[0]?.warehouseName || '—', icon: Warehouse },
        { label: 'Date', value: record.date || '—', icon: Calendar },
        { label: 'Source document', value: record.sourceHeldBillNumber ? `Onhold Bill ${record.sourceHeldBillNumber}` : record.sourceGrnNumber || '—' },
        { label: 'Reason', value: record.reason || '—', wide: true, icon: MessageSquare },
        ...(record.remarks ? [{ label: 'Remarks', value: record.remarks, wide: true, icon: MessageSquare }] : []),
      ]}
      columns={[
        { label: 'Product code', value: (item) => item.productCode || item.sku || item.productSku || '—' },
        { label: 'Product name', value: (item) => item.productName || '—' },
        { label: 'Warehouse', value: (item) => item.warehouseName || record.warehouse || record.warehouseName || '—' },
        { label: 'Linked GRN', value: (item) => item.sourceGrnNumber || record.sourceGrnNumber || '—' },
        {
          label: 'Stock before',
          numeric: true,
          value: (item) => (item.availableStock != null ? item.availableStock : item.systemQuantity != null ? item.systemQuantity : '—'),
        },
        {
          label: 'Qty adjusted',
          numeric: true,
          value: (item) => {
            const qty = Math.abs(Number(item.quantity ?? item.differenceQuantity ?? 0));
            const isReduction = record.type === 'Reduction' || Number(item.differenceQuantity ?? 0) < 0;
            return `${isReduction ? '-' : '+'}${qty}`;
          },
        },
        {
          label: 'Stock after',
          numeric: true,
          value: (item) => (item.after != null ? item.after : item.physicalQuantity != null ? item.physicalQuantity : '—'),
        },
        { label: 'Reason', value: (item) => item.reason || record.reason || '—' },
      ]}
    />
  );
}
