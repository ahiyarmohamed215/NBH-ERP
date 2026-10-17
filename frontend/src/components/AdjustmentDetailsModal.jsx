import React from 'react';
import {Edit2, RotateCcw, CheckCircle} from 'lucide-react';
import RecordDetailsModal from './RecordDetailsModal';
import {adjustmentStatus, adjustmentQuantity, printStockAdjustment} from '../utils/stockAdjustmentPresentation';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

export default function AdjustmentDetailsModal({record,onClose,onEdit,onCancel,onAdjust,busy,canManage}) {
  const status=adjustmentStatus(record);
  const signedQuantity=adjustmentQuantity(record);
  const details=[
    ['Record number',record.recordNo || (record.id ? `ADJ-${record.id}` : '—')],
    ['Adjustment type',record.type || (Number(record.quantity || 0)>=0?'Addition':'Reduction')],
    ['Warehouse',record.warehouse || '—'],
    ['Date',record.date || '—'],
    ['Linked GRN',record.sourceGrnNumber || '—'],
    ['Batch number',record.batch || record.recordNo || '—'],
    ['Quantity adjusted',signedQuantity],
    ['Reason',record.reason || '—',true],
    ...(record.remarks?[['Remarks',record.remarks,true]]:[]),
  ];
  return <RecordDetailsModal
    label="Stock adjustment details"
    title={record.productName || 'Stock adjustment'}
    subtitle={`${record.sku || 'Product not selected'} · Adjustment #${record.recordNo || record.id}`}
    status={status}
    details={details}
    onClose={onClose}
    onPrint={()=>printStockAdjustment(record)}
    allowDraftPrint={true}
    actions={canManage && status!=='CANCELLED' && (
      <div className="purchase-inspection-detail-actions record-actions master-details-management" aria-label="Adjustment management actions">
        <button type="button" className="btn btn-glass erp-button" aria-label="Edit Adjustment" disabled={busy} onClick={onEdit}>
          <Edit2 size={14}/> Edit Adjustment
        </button>
        {status==='DRAFT' && (
          <button type="button" className="btn btn-glass erp-button purchase-inspection-success" aria-label="Adjust stock" disabled={busy} onClick={onAdjust}>
            <CheckCircle size={14}/> Adjust stock
          </button>
        )}
        <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" aria-label="Cancel adjustment" disabled={busy} onClick={onCancel}>
          <RotateCcw size={14}/> Cancel adjustment
        </button>
      </div>
    )}
  />;
}
