import React from 'react';
import { RotateCcw, Edit2, UserRound, Calendar, MessageSquare, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';

export default function QuotationDetailsModal({
  quotation,
  onClose,
  onPrint,
  onCancel,
  onEdit,
  onConvert,
  canManage = false,
  processing = false,
}) {
  if (!quotation) return null;

  const actions = [];
  if (canManage) {
    if (quotation.status !== 'CANCELLED' && quotation.status !== 'CONVERTED') {
      if (onConvert) {
        actions.push({
          label: 'Convert to Invoice',
          icon: CheckCircle,
          onClick: onConvert,
          disabled: processing,
          tone: 'success',
        });
      }
      if (onEdit) {
        actions.push({
          label: 'Edit Quotation',
          icon: Edit2,
          onClick: onEdit,
          disabled: processing,
        });
      }
      if (onCancel) {
        actions.push({
          label: 'Cancel Quotation',
          icon: RotateCcw,
          onClick: onCancel,
          disabled: processing,
          tone: 'danger',
        });
      }
    }
  }

  const details = [
    { label: 'Customer name', value: quotation.customerName || 'Walk-in Customer', icon: UserRound },
    { label: 'Quotation date', value: quotation.quotationDate || quotation.date, icon: Calendar },
    { label: 'Valid until', value: quotation.validUntil || '—', icon: Calendar },
  ];

  if (quotation.customerPhone || quotation.customerEmail) {
    details.push({
      label: 'Customer contact',
      value: [quotation.customerPhone, quotation.customerEmail].filter(Boolean).join(' • '),
      icon: Phone,
    });
  }

  if (quotation.convertedInvoiceNumber || quotation.convertedInvoiceId) {
    details.push({
      label: 'Commercial invoice',
      value: quotation.convertedInvoiceNumber || `INV #${quotation.convertedInvoiceId}`,
      icon: CheckCircle,
    });
  }

  if (quotation.status === 'CANCELLED') {
    details.push({
      label: 'Cancellation reason',
      value: (quotation.cancelReason || 'Cancelled') + (quotation.cancelledBy ? ` (by ${quotation.cancelledBy})` : ''),
      wide: true,
      icon: AlertCircle,
    });
  }

  if (quotation.notes || quotation.terms) {
    details.push({
      label: 'Remarks / Terms',
      value: [quotation.notes, quotation.terms].filter(Boolean).join('\n\n'),
      wide: true,
      icon: MessageSquare,
    });
  }

  const subtotal = Number(quotation.subtotal ?? (quotation.totalAmount || 0));
  const discount = Number(quotation.discountAmount || 0);
  const tax = Number(quotation.taxAmount || 0);
  const total = Number(quotation.totalAmount || 0);

  const footerSummary = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        padding: '12px 20px',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: 'var(--erp-text-body)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: '16px', color: '#64748b', flexWrap: 'wrap' }}>
        <span>Subtotal: <strong style={{ color: '#0f172a' }}>LKR {subtotal.toFixed(2)}</strong></span>
        {discount > 0 && <span>Discount: <strong style={{ color: '#e11d48' }}>- LKR {discount.toFixed(2)}</strong></span>}
        {tax > 0 && <span>Tax: <strong style={{ color: '#0f172a' }}>+ LKR {tax.toFixed(2)}</strong></span>}
      </div>
      <div style={{ fontSize: 'var(--erp-text-section)', fontWeight: 800, color: '#0284c7' }}>
        Total Amount: LKR {total.toFixed(2)}
      </div>
    </div>
  );

  return (
    <PurchaseInspectionModal
      type="QUOTATION"
      number={quotation.quotationNumber || quotation.quotationNo}
      status={quotation.status}
      rows={quotation.items || []}
      detailActions={actions}
      onPrint={onPrint}
      onClose={onClose}
      actionsPosition="bottom"
      detailsPosition="header"
      showHeaderClose
      closeLabel="Close"
      tableToolbar
      tableSearchPlaceholder="Search quoted product..."
      tableSearchLabel="Search quoted products"
      emptyMessage="No items in this quotation."
      footer={footerSummary}
      details={details}
      columns={[
        { label: 'Product code', value: (item) => item.productSku || '—' },
        { label: 'Product name', value: (item) => item.productName || '—' },
        { label: 'Qty', numeric: true, value: (item) => item.quantity },
        { label: 'Unit price', numeric: true, value: (item) => 'LKR ' + Number(item.unitPrice || 0).toFixed(2) },
        {
          label: 'Discount',
          numeric: true,
          value: (item) =>
            Number(item.discountAmount || 0) > 0
              ? 'LKR ' + Number(item.discountAmount).toFixed(2)
              : Number(item.discountRate || 0) > 0
              ? Number(item.discountRate) + '%'
              : '—',
        },
        { label: 'Line total', numeric: true, value: (item) => 'LKR ' + Number(item.totalPrice || 0).toFixed(2) },
      ]}
    />
  );
}
