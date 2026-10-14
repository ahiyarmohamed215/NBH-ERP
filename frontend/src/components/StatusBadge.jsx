import React from 'react';
import './StatusBadge.css';

const successStatuses = new Set(['AVAILABLE','DELIVERED','ACTIVE', 'PROCESSED', 'TRANSFERRED', 'COMPLETED', 'APPROVED', 'RECEIVED', 'ORDERED', 'INFORM_TO_ORDER', 'IN_STOCK', 'PAID', 'CLEARED', 'ACCEPTED', 'RESTOCKED', 'VERIFIED', 'DISPATCHED', 'STOCK_ADJUSTED']);
const pendingStatuses = new Set(['SCHEDULED','IN_TRANSIT','ON_DELIVERY','OUT_FOR_DELIVERY','DRAFT', 'PENDING', 'PROCESSING', 'PARTIALLY_RECEIVED', 'LOW_STOCK', 'PARTIAL', 'HELD', 'HELD_AT_POS', 'SENT_TO_WAREHOUSE']);
const inactiveStatuses = new Set(['INACTIVE', 'CANCELLED', 'CANCELED', 'REJECTED', 'OUT_OF_STOCK', 'VOIDED', 'BOUNCED', 'SCRAPPED', 'UNPAID', 'OVERDUE', 'EXPIRED']);

export default function StatusBadge({ status, label, onClick, title, disabled, 'aria-label': ariaLabel }) {
  const value = String(status || 'DRAFT').toUpperCase();
  const tone = successStatuses.has(value) ? 'success' : pendingStatuses.has(value) ? 'pending' : inactiveStatuses.has(value) ? 'inactive' : 'neutral';
  const Tag = onClick ? 'button' : 'span';
  return <Tag className={`erp-status-badge erp-status-${tone}`} data-status={value} title={title} aria-label={ariaLabel}
    {...(onClick ? { type: 'button', onClick, disabled } : {})}>
    <span className="erp-status-dot" aria-hidden="true" />{label || value.replaceAll('_', ' ')}
  </Tag>;
}
