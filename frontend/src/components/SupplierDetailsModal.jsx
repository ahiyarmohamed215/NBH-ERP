import React, { useState, useEffect } from 'react';
import {
  UserRound,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Printer,
  X,
  Ban,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import './PurchaseInspectionModal.css';
import './SupplierDetailsModal.css';

export default function SupplierDetailsModal({
  supplier = {},
  active,
  onClose,
  onPrint,
  onEdit,
  onStatusChange,
  canManage = true
}) {
  const [copiedField, setCopiedField] = useState(null);
  const status = supplier.status || (active ? 'ACTIVE' : 'INACTIVE');
  const code = supplier.supplierCode || supplier.code || 'Supplier';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard error
    }
  };

  const getInitials = (name) => {
    if (!name) return 'SP';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="modal-backdrop purchasing-no-shadows supplier-minimal-backdrop"
      style={{ padding: 12, zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        className="glass-modal purchase-inspection supplier-inspection supplier-floating-card purchase-inspection-bottom-actions"
        role="dialog"
        aria-modal="true"
        aria-label="Supplier details"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Card Header */}
        <header className="supplier-floating-header">
          <div className="supplier-floating-brand">
            <div className="supplier-floating-avatar" aria-hidden="true">
              {getInitials(supplier.name)}
            </div>
            <div className="supplier-floating-identity">
              <div className="supplier-floating-meta">
                <span className="supplier-floating-code">{code}</span>
                <button
                  type="button"
                  className="supplier-copy-btn"
                  title="Copy supplier code"
                  onClick={() => handleCopy(code, 'code')}
                >
                  {copiedField === 'code' ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedField === 'code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <h2 className="erp-dialog-title supplier-floating-title" title={supplier.name}>
                {supplier.name || 'Unnamed Supplier'}
              </h2>
            </div>
          </div>

          <div className="supplier-floating-top-actions">
            <StatusBadge status={status} title={`Status: ${status}`} />
            <button
              type="button"
              className="purchase-inspection-close supplier-floating-close"
              aria-label="Close supplier details"
              title="Close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* High-density Content Body */}
        <div className="purchase-inspection-details-card supplier-floating-body">
          <dl className="purchase-inspection-details supplier-floating-grid" aria-label="Supplier contact details">
            {/* Contact Person */}
            <div className="supplier-grid-cell supplier-grid-cell-full">
              <dt>
                <UserRound size={13} strokeWidth={1.7} /> Contact person
              </dt>
              <dd className="supplier-val-highlight">{supplier.contactPerson || '—'}</dd>
            </div>

            {/* Phone */}
            <div className="supplier-grid-cell">
              <dt>
                <Phone size={13} strokeWidth={1.7} /> Phone
              </dt>
              <dd>
                {supplier.phone ? (
                  <div className="supplier-actionable-val">
                    <a href={`tel:${supplier.phone}`} className="supplier-contact-link" title="Call number">
                      {supplier.phone}
                    </a>
                    <button
                      type="button"
                      className="supplier-inline-copy"
                      title="Copy phone"
                      onClick={() => handleCopy(supplier.phone, 'phone')}
                    >
                      {copiedField === 'phone' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            {/* Email */}
            <div className="supplier-grid-cell">
              <dt>
                <Mail size={13} strokeWidth={1.7} /> Email
              </dt>
              <dd>
                {supplier.email ? (
                  <div className="supplier-actionable-val">
                    <a href={`mailto:${supplier.email}`} className="supplier-contact-link" title="Send email">
                      {supplier.email}
                    </a>
                    <button
                      type="button"
                      className="supplier-inline-copy"
                      title="Copy email"
                      onClick={() => handleCopy(supplier.email, 'email')}
                    >
                      {copiedField === 'email' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            {/* Address */}
            <div className="supplier-grid-cell supplier-grid-cell-full">
              <dt>
                <MapPin size={13} strokeWidth={1.7} /> Address
              </dt>
              <dd>
                {supplier.address ? (
                  <div className="supplier-actionable-val">
                    <span>{supplier.address}</span>
                    <button
                      type="button"
                      className="supplier-inline-copy"
                      title="Copy address"
                      onClick={() => handleCopy(supplier.address, 'address')}
                    >
                      {copiedField === 'address' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          {canManage && (
            <div className="purchase-inspection-detail-actions supplier-floating-manage-actions">
              {status !== 'INACTIVE' && (
                <button type="button" className="btn btn-glass erp-button supplier-btn-edit" onClick={onEdit}>
                  <Edit2 size={15} /> Edit Supplier
                </button>
              )}
              {status === 'INACTIVE' && (
                <button
                  type="button"
                  className="btn btn-glass purchase-inspection-success erp-button supplier-btn-activate"
                  onClick={() => onStatusChange('ACTIVE')}
                >
                  <CheckCircle size={15} /> Process Supplier
                </button>
              )}
              {status !== 'INACTIVE' && (
                <button
                  type="button"
                  className="btn btn-glass purchase-inspection-danger erp-button supplier-btn-deactivate"
                  onClick={() => onStatusChange('INACTIVE')}
                >
                  <Ban size={15} /> Cancel Supplier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Floating Card Actions Footer */}
        <aside className="purchase-inspection-actions supplier-floating-footer" aria-label="Supplier actions">
          <div className="supplier-footer-hint">
            <span className={`supplier-dot ${status === 'ACTIVE' ? 'active' : 'inactive'}`} />
            <span>{status === 'ACTIVE' ? 'Active Partner • Orders Allowed' : 'Inactive Partner • Orders Paused'}</span>
          </div>
          <div className="supplier-footer-btns">
            <button
              type="button"
              className="btn btn-primary erp-button supplier-print-btn"
              title="Print Supplier Details (A4)"
              onClick={onPrint}
            >
              <Printer size={15} /> Print
            </button>
            <button type="button" className="btn btn-glass erp-button" onClick={onClose}>
              Close
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
