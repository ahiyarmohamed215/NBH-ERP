import React from 'react';
import './StatusBadge.css';

const successStatuses = new Set(['ACTIVE', 'PROCESSED', 'TRANSFERRED', 'COMPLETED', 'APPROVED', 'RECEIVED', 'ORDERED', 'INFORM_TO_ORDER', 'IN_STOCK']);
const pendingStatuses = new Set(['DRAFT', 'PENDING', 'PROCESSING', 'PARTIALLY_RECEIVED', 'LOW_STOCK']);
const inactiveStatuses = new Set(['INACTIVE', 'CANCELLED', 'CANCELED', 'REJECTED', 'OUT_OF_STOCK']);

export default function StatusBadge({ status, onClick, title, disabled }) {
  const value = String(status || 'DRAFT').toUpperCase();
  const tone = successStatuses.has(value) ? 'success' : pendingStatuses.has(value) ? 'pending' : inactiveStatuses.has(value) ? 'inactive' : 'neutral';
  const Tag = onClick ? 'button' : 'span';
  return <Tag className={`erp-status-badge erp-status-${tone}`} data-status={value} title={title}
    {...(onClick ? { type: 'button', onClick, disabled } : {})}>
    <span className="erp-status-dot" aria-hidden="true" />{value.replaceAll('_', ' ')}
  </Tag>;
}
