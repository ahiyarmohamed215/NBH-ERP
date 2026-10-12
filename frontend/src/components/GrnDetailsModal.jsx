import React from 'react';
import { RotateCcw, CheckCircle, Edit2, UserRound, Calendar, MessageSquare } from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';

export default function GrnDetailsModal({ grn, onClose, onPrint, onCancel, onEdit, onProcess, canManage = false, processing = false }) {
  const actions = [];
  if (canManage) {
    if (grn.status !== 'CANCELLED') actions.push({ label: 'Edit GRN', icon: Edit2, onClick: onEdit, disabled: processing });
    if (grn.status !== 'PROCESSED') actions.push({ label: processing ? 'Processing…' : grn.status === 'CANCELLED' ? 'Reprocess GRN' : 'Process GRN', icon: CheckCircle, onClick: onProcess, disabled: processing });
    if (grn.status !== 'CANCELLED') actions.push({ label: 'Cancel GRN', icon: RotateCcw, onClick: onCancel, disabled: processing, tone: 'danger' });
  }
  return <PurchaseInspectionModal type="GRN" number={grn.grnNumber} status={grn.status} rows={grn.items || []} actions={actions} onPrint={onPrint} onClose={onClose} actionsPosition="bottom"
    details={[
      { label: 'Supplier name', value: grn.supplierName, icon: UserRound },
      { label: 'GRN date', value: grn.receivedDate, icon: Calendar },
      { label: 'Remarks', value: grn.notes, wide: true, icon: MessageSquare },
    ]}
    columns={[
      { label: 'Product code', value: item => item.productSku || item.productBarcode || '—' },
      { label: 'Product name', value: item => item.productName || '—' },
      { label: 'Qty', numeric: true, value: item => item.quantityReceived },
      { label: 'Unit price', numeric: true, value: item => 'LKR ' + Number(item.unitCost || 0).toFixed(2) },
      { label: 'MP%', numeric: true, value: item => item.markupPercent == null ? '—' : Number(item.markupPercent) + '%' },
      { label: 'Selling price', numeric: true, value: item => item.sellingPrice == null ? '—' : 'LKR ' + Number(item.sellingPrice).toFixed(2) },
    ]} />;
}
