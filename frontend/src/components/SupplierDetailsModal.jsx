import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
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
  Check,
  Building2,
  Trash2
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
  onDelete,
  canManage = true
}) {
  const [copiedField, setCopiedField] = useState(null);
  const dialogRef = useRef(null);
  const status = supplier.status || (active ? 'ACTIVE' : 'INACTIVE');
  const code = supplier.supplierCode || supplier.code || 'Supplier';
  const isActive = status === 'ACTIVE';

  /* Only handle keys while this is the topmost dialog. */
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('.supplier-card-close')?.focus();
    const onKey = (e) => {
      const dialogs=[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if(dialogs.at(-1)!==dialogRef.current)return;
      if (e.key === 'Escape' && !e.defaultPrevented) { e.stopPropagation(); onClose(); }
      if(e.key==='Tab') {
        const controls=[...dialogRef.current.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')];
        const first=controls[0],last=controls.at(-1);
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);

  const handleCopy = (text, field) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1600);
    } catch { /* silent */ }
  };

  const getInitials = (name) => {
    if (!name) return 'SP';
    const w = name.trim().split(/\s+/).filter(Boolean);
    return w.length >= 2
      ? (w[0][0] + w[1][0]).toUpperCase()
      : w[0].slice(0, 2).toUpperCase();
  };

  const CopyBtn = ({ value, field, label }) => (
    <button
      type="button"
      className={`supplier-card-copy-chip${copiedField === field ? ' copied' : ''}`}
      title={copiedField === field ? 'Copied!' : `Copy ${label}`}
      aria-label={copiedField === field ? `${label} copied` : `Copy supplier ${label}`}
      onClick={(e) => { e.stopPropagation(); handleCopy(value, field); }}
    >
      {copiedField === field ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );

  return (
    <div
      className="modal-backdrop purchasing-no-shadows supplier-card-backdrop"
      style={{ padding: 12, zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="glass-modal purchase-inspection supplier-inspection supplier-floating-card purchase-inspection-bottom-actions"
        role="dialog"
        aria-modal="true"
        aria-label="Supplier details"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Bar ── */}
        <header className="supplier-card-topbar">
          <div className="supplier-card-identity">
            <div className="supplier-card-avatar" aria-hidden="true">
              {getInitials(supplier.name)}
            </div>
            <div className="supplier-card-name-block">
              <h2 className="erp-dialog-title supplier-card-name" title={supplier.name}>
                {supplier.name || '—'}
              </h2>
              <div className="supplier-card-meta-row">
                <span className="supplier-card-code">{code}</span>
                <CopyBtn value={code} field="code" label="code" />
                <StatusBadge status={status} title={`Status: ${status}`} />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="purchase-inspection-close supplier-card-close"
            aria-label="Close supplier details"
            title="Close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        {/* ── Contact Details ── */}
        <div className="purchase-inspection-details-card supplier-card-body">
          <div className="supplier-card-section-label">
            <Building2 size={16} strokeWidth={1.8} />
            <span>Contact details</span>
          </div>

          <dl className="purchase-inspection-details supplier-card-details" aria-label="Supplier contact details">
            {/* Contact Person */}
            <div className="supplier-card-row">
              <dt><UserRound size={18} strokeWidth={1.7} /> Contact person</dt>
              <dd className="supplier-card-value-primary">{supplier.contactPerson || '—'}</dd>
            </div>

            {/* Phone */}
            <div className="supplier-card-row">
              <dt><Phone size={18} strokeWidth={1.7} /> Phone</dt>
              <dd>
                {supplier.phone ? (
                  <span className="supplier-card-actionable">
                    <a href={`tel:${supplier.phone}`} className="supplier-card-link">{supplier.phone}</a>
                    <CopyBtn value={supplier.phone} field="phone" label="phone" />
                  </span>
                ) : '—'}
              </dd>
            </div>

            {/* Email */}
            <div className="supplier-card-row">
              <dt><Mail size={18} strokeWidth={1.7} /> Email</dt>
              <dd>
                {supplier.email ? (
                  <span className="supplier-card-actionable">
                    <a href={`mailto:${supplier.email}`} className="supplier-card-link">{supplier.email}</a>
                    <CopyBtn value={supplier.email} field="email" label="email" />
                  </span>
                ) : '—'}
              </dd>
            </div>

            {/* Address */}
            <div className="supplier-card-row supplier-card-row-full">
              <dt><MapPin size={18} strokeWidth={1.7} /> Address</dt>
              <dd>
                {supplier.address ? (
                  <span className="supplier-card-actionable">
                    <span className="supplier-card-address">{supplier.address}</span>
                    <CopyBtn value={supplier.address} field="address" label="address" />
                  </span>
                ) : '—'}
              </dd>
            </div>
          </dl>

          {/* Management Actions */}
          {canManage && (
            <div className="purchase-inspection-detail-actions supplier-card-actions">
                <button type="button" className="btn btn-glass erp-button supplier-card-btn-edit" onClick={onEdit}>
                  <Edit2 size={16} /> Edit Supplier
                </button>
              {status === 'INACTIVE' && (
                <button
                  type="button"
                  className="btn btn-glass purchase-inspection-success erp-button"
                  onClick={() => onStatusChange('ACTIVE')}
                >
                  <CheckCircle size={16} /> Reactivate Supplier
                </button>
              )}
              {status === 'DRAFT' && <button type="button" className="btn btn-glass purchase-inspection-success erp-button" onClick={() => onStatusChange('ACTIVE')}><CheckCircle size={16}/> Activate Supplier</button>}
              {status === 'ACTIVE' && (
                <button
                  type="button"
                  className="btn btn-glass purchase-inspection-danger erp-button"
                  onClick={() => onStatusChange('INACTIVE')}
                >
                  <Ban size={16} /> Deactivate Supplier
                </button>
              )}
              {onDelete && <button type="button" className="btn btn-glass purchase-inspection-danger erp-button" onClick={onDelete}><Trash2 size={16}/> Delete Supplier</button>}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <aside className="purchase-inspection-actions supplier-card-footer" aria-label="Supplier actions">
          <div className="supplier-card-status-hint">
            <span className={`supplier-card-pulse ${isActive ? 'active' : 'inactive'}`} />
            <span>{isActive ? 'Active partner' : status === 'DRAFT' ? 'Draft supplier' : 'Inactive partner'}</span>
          </div>
          <div className="supplier-card-footer-btns">
            <button
              type="button"
              className="btn btn-glass erp-button"
              title="Print Supplier Details (A4)"
              onClick={onPrint}
            >
              <Printer size={16} /> Print
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
