import React from 'react';
import { Edit2, RotateCcw, CheckCircle, Warehouse, Calendar, MessageSquare, Printer } from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';
import { adjustmentStatus, adjustmentQuantity, printStockAdjustment } from '../utils/stockAdjustmentPresentation';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

export default function AdjustmentDetailsModal({ record, onClose, onEdit, onCancel, onAdjust, busy, canManage }) {
  const status = adjustmentStatus(record);
  const signedQuantity = adjustmentQuantity(record);
  const items = record.items && record.items.length > 0 ? record.items : [record];

  return (
    <PurchaseInspectionModal
      type="Adjustment"
      ariaLabel="Stock adjustment details"
      className="record-details-compact"
      closeAriaLabel="Close stock adjustment details"
      number={record.recordNo || (record.id ? `ADJ-${record.id}` : '—')}
      status={status}
      rows={items}
      onPrint={() => printStockAdjustment(record)}
      onClose={onClose}
      tableToolbar
      tablePrint={true}
      actionsPosition="bottom"
      detailsPosition="header"
      showHeaderClose
      closeLabel="Close"
      details={[
        { label: 'Record number', value: record.recordNo || (record.id ? `ADJ-${record.id}` : '—') },
        { label: 'Quantity adjusted', value: signedQuantity },
        { label: 'Adjustment type', value: record.type || (Number(record.quantity || 0) >= 0 ? 'Addition' : 'Reduction') },
        { label: 'Warehouse', value: record.warehouse || '—', icon: Warehouse },
        { label: 'Date', value: record.date || '—', icon: Calendar },
        { label: 'Linked GRN', value: record.sourceGrnNumber || '—' },
        { label: 'Reason', value: record.reason || '—', wide: true, icon: MessageSquare },
        ...(record.remarks ? [{ label: 'Remarks', value: record.remarks, wide: true, icon: MessageSquare }] : []),
      ]}
      columns={[
        { label: 'Product code', value: (item) => item.productCode || item.sku || item.productSku || '—' },
        { label: 'Product name', value: (item) => item.productName || '—' },
        { label: 'Linked GRN', value: (item) => item.sourceGrnNumber || record.sourceGrnNumber || '—' },
        {
          label: 'Available before',
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
          label: 'Available after',
          numeric: true,
          value: (item) => (item.after != null ? item.after : item.physicalQuantity != null ? item.physicalQuantity : '—'),
        },
        { label: 'Reason', value: (item) => item.reason || record.reason || '—' },
      ]}
      footer={
        <footer className="master-details-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
          {canManage && status !== 'CANCELLED' ? (
            <div className="purchase-inspection-detail-actions record-actions master-details-management" aria-label="Adjustment management actions">
              <button type="button" className="btn btn-glass erp-button" aria-label="Edit Adjustment" disabled={busy} onClick={onEdit}>
                <Edit2 size={14} /> Edit Adjustment
              </button>
              {status === 'DRAFT' && (
                <button type="button" className="btn btn-glass erp-button purchase-inspection-success" aria-label="Adjust stock" disabled={busy} onClick={onAdjust}>
                  <CheckCircle size={14} /> Adjust stock
                </button>
              )}
              <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" aria-label="Cancel adjustment" disabled={busy} onClick={onCancel}>
                <RotateCcw size={14} /> Cancel adjustment
              </button>
            </div>
          ) : <div />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-glass erp-button" onClick={() => printStockAdjustment(record)}>
              <Printer size={14} /> Print
            </button>
            <button type="button" className="btn btn-glass erp-button" onClick={onClose}>
              Close
            </button>
          </div>
        </footer>
      }
    />
  );
}
