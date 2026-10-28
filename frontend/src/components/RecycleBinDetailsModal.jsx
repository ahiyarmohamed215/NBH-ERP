import React, { useEffect, useRef } from 'react';
import {
  X,
  Printer,
  RotateCcw,
  Trash2,
  Package,
  Truck,
  Tag,
  Warehouse,
  FolderTree,
  ShieldCheck,
  Users,
  Calendar,
  Hash,
  Info,
  FileText,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { printA4Report } from '../utils/printReport';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

const entityIcons = {
  VEHICLE: Truck,
  DELIVERY_ROUTE: Truck,
  PRODUCT: Package,
  SUPPLIER: Truck,
  BRAND: Tag,
  WAREHOUSE: Warehouse,
  CATEGORY: FolderTree,
  ALLOCATION: ShieldCheck,
  USER: Users,
  CUSTOMER: Users,
};

export function formatRecycleBinDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

export default function RecycleBinDetailsModal({
  record,
  label = 'Record',
  busy = false,
  onClose,
  onRestore,
  onDelete,
}) {
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('[data-close]')?.focus();

    const handleKeyDown = (event) => {
      if ([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.current) return;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const controls = [...dialog.current.querySelectorAll('button:not(:disabled),a[href]')];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.();
    };
  }, []);

  if (!record) return null;

  const type = record.type || 'RECORD';
  const TypeIcon = entityIcons[type] || Trash2;
  const typeLabel = label || type;
  const recordName = record.name || record.fullName || record.code || '—';
  const recordCode = record.code || record.supplierCode || record.sku || String(record.id || '—');
  const deletedAtFormatted = formatRecycleBinDate(record.deletedAt);

  const details = [
    { label: 'Record Type', value: typeLabel, icon: TypeIcon },
    { label: 'Record Code', value: recordCode, icon: Hash },
    { label: 'Name / Description', value: recordName, wide: true, icon: FileText },
    { label: 'Deleted On', value: deletedAtFormatted, icon: Calendar },
    { label: 'System ID', value: String(record.id ?? '—'), icon: Info },
    { label: 'Lifecycle Status', value: 'Deleted (Stored in Recycle Bin)', wide: true, icon: Trash2 },
  ];

  const escapeText = (value) =>
    String(value ?? '—').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  const handlePrint = () => {
    printA4Report({
      title: `Recycle Bin - ${escapeText(typeLabel)} (${escapeText(recordCode)})`,
      metaItems: [
        { label: 'Record Type', value: escapeText(typeLabel) },
        { label: 'Code', value: escapeText(recordCode) },
        { label: 'Name', value: escapeText(recordName) },
        { label: 'Deleted On', value: escapeText(deletedAtFormatted) },
        { label: 'Status', value: 'DELETED' },
      ],
      columns: [
        { header: 'Property', accessor: 'property', width: '35%' },
        { header: 'Details', accessor: 'value' },
      ],
      data: details.map((d) => ({
        property: escapeText(d.label),
        value: escapeText(d.value),
      })),
    });
  };

  return (
    <div
      className="modal-backdrop purchasing-no-shadows master-details-backdrop"
      style={{ padding: '12px', zIndex: 1100 }}
      onClick={onClose}
    >
      <section
        ref={dialog}
        className="glass-modal purchase-inspection master-details-modal record-details-compact recycle-bin-inspection"
        role="dialog"
        aria-modal="true"
        aria-label={`${typeLabel} details`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="purchase-inspection-header">
          <div className="purchase-inspection-title" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              className="grn-inspection-symbol"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TypeIcon size={22} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="purchase-inspection-caption" style={{ textTransform: 'uppercase' }}>
                  DELETED {typeLabel.toUpperCase()}
                </span>
              </div>
              <div className="purchase-inspection-number-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                <h2 className="erp-dialog-title" style={{ margin: 0 }}>{recordName}</h2>
                <StatusBadge status="DELETED" />
              </div>
              <div className="master-details-meta" style={{ marginTop: '2px', fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                <span>{typeLabel} · <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{recordCode}</strong></span>
              </div>
            </div>
          </div>
          <button
            data-close
            type="button"
            className="master-details-close purchase-inspection-close"
            aria-label={`Close ${typeLabel.toLowerCase()} details`}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="master-details-body">
          <dl className="purchase-inspection-details master-details-grid">
            {details.map(({ label: itemLabel, value: itemVal, wide }) => (
              <div key={itemLabel} className={wide ? 'master-details-wide' : undefined}>
                <dt>{itemLabel}</dt>
                <dd>{itemVal == null || itemVal === '' ? '—' : itemVal}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="purchase-inspection-detail-actions record-actions"
          aria-label={`${typeLabel} management actions`}
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            className="btn btn-glass erp-button purchase-inspection-success"
            aria-label={`Restore ${typeLabel} ${recordCode}`}
            disabled={busy}
            onClick={() => onRestore(record)}
            style={{
              borderColor: '#86efac',
              background: '#f0fdf4',
              color: '#15803d',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} /> Restore Record
          </button>
          <button
            type="button"
            className="btn btn-glass erp-button purchase-inspection-danger"
            aria-label={`Permanently delete ${typeLabel} ${recordCode}`}
            disabled={busy}
            onClick={() => onDelete(record)}
            style={{
              borderColor: '#fca5a5',
              background: '#fef2f2',
              color: '#dc2626',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={14} /> Delete Permanently
          </button>
        </div>

        <footer
          className="master-details-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 18px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <button
            type="button"
            className="btn btn-glass erp-button"
            title="Print Details (A4)"
            aria-label={`Print ${typeLabel} details`}
            onClick={handlePrint}
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            className="btn btn-glass erp-button"
            onClick={onClose}
            aria-label={`Close ${typeLabel} popup`}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
