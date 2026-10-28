import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Package, Check, Layers, AlertCircle, Sparkles } from 'lucide-react';
import './HeldInvoiceDialog.css';

const fields = [
  ['boxes', 'Box'],
  ['bags', 'Bag'],
  ['pBags', 'P. Bag'],
  ['others', 'Others']
];

export default function HeldInvoiceDialog({
  preview,
  busy = false,
  error,
  onClose,
  onConfirm
}) {
  const [enteredPacking, setPacking] = useState({ boxes: '', bags: '', pBags: '', others: '' });
  const automaticPacking=preview?.packing;
  const packing=automaticPacking || enteredPacking;
  const dialog = useRef(null);
  const first = useRef(null);

  // Validation strictly aligns with testing: each field must be non-negative integer <= 1,000,000
  const valid = fields.every(
    ([key]) => /^\d+$/.test(String(packing[key])) && Number(packing[key]) <= (automaticPacking?100000000:1000000)
  );

  useEffect(() => {
    const previous = document.activeElement;
    first.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const keydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key === 'Tab') {
      const controls = [
        ...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')
      ];
      const firstControl = controls[0];
      const lastControl = controls.at(-1);
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl?.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl?.focus();
      }
    }
  };

  const handleFillAllZero = () => {
    setPacking({ boxes: '0', bags: '0', pBags: '0', others: '0' });
  };

  const sourceBillsList = Array.isArray(preview?.sourceBills)
    ? preview.sourceBills
    : typeof preview?.sourceBills === 'string'
    ? preview.sourceBills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const totalQuantity = (preview?.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  return createPortal(
    <div className="modal-backdrop held-invoice-backdrop">
      <form
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="held-invoice-title"
        className="held-invoice-dialog purchasing-no-shadows"
        onKeyDown={keydown}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) {
            onConfirm(
              Object.fromEntries(fields.map(([key]) => [key, Number(packing[key])]))
            );
          }
        }}
      >
        <header className="held-invoice-header">
          <div className="held-invoice-heading">
            <div className="held-invoice-icon-badge">
              <FileText size={20} />
            </div>
            <div>
              <div className="held-invoice-title-row">
                <h2 id="held-invoice-title" className="erp-dialog-title">
                  Create Commercial Invoice
                </h2>
                {sourceBillsList.length > 1 && (
                  <span className="held-merge-badge">
                    <Layers size={13} /> Merging {sourceBillsList.length} Bills
                  </span>
                )}
              </div>
              <p>Review consolidated items and packing dispatch quantities.</p>
            </div>
          </div>
          <button
            type="button"
            className="purchase-inspection-close held-invoice-close"
            aria-label="Close create invoice"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="held-invoice-body">
          {/* Metadata Cards */}
          <div className="held-invoice-meta-grid">
            <div className="held-meta-card">
              <span className="held-meta-label">Billed Customer</span>
              <strong className="held-meta-value">{preview?.customerName || 'Walk-in'}</strong>
            </div>

            <div className="held-meta-card">
              <span className="held-meta-label">Invoice Date</span>
              <strong className="held-meta-value">{preview?.date || new Date().toISOString().slice(0, 10)}</strong>
            </div>

            <div className="held-meta-card">
              <span className="held-meta-label">Total Units</span>
              <strong className="held-meta-value">{totalQuantity} units ({preview?.items?.length || 0} lines)</strong>
            </div>
          </div>

          {/* Merged Onhold Bills Pill Row */}
          <div className="held-source-bills-section">
            <div className="held-source-bills-label">
              <span>Source Onhold Bills ({sourceBillsList.length}):</span>
            </div>
            <div className="held-source-bills-list">
              {sourceBillsList.map((billNumber) => (
                <span key={billNumber} className="held-bill-chip">
                  {billNumber}
                </span>
              ))}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="held-invoice-items-wrapper">
            <div className="held-items-table-header">
              <span>Consolidated Invoiced Items ({preview?.items?.length || 0})</span>
            </div>
            <div className="erp-table-frame erp-table-scroll held-invoice-items">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="erp-table-heading" style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th className="erp-table-heading">Product / Description</th>
                    <th className="erp-table-heading" style={{ width: '130px' }}>Warehouse</th>
                    <th className="erp-table-heading" style={{ width: '80px', textAlign: 'right' }}>Quantity</th>
                    <th className="erp-table-heading" style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                    <th className="erp-table-heading" style={{ width: '120px', textAlign: 'right' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.items || []).map((item, index) => {
                    const unitPrice = Number(item.unitPrice || 0);
                    const lineTotal = Number(item.totalPrice ?? (item.quantity * unitPrice));
                    return (
                      <tr key={index}>
                        <td className="erp-table-cell" style={{ textAlign: 'center', color: '#94a3b8' }}>
                          {index + 1}
                        </td>
                        <td className="erp-table-cell">
                          <strong className="held-item-name">{item.productName || 'Product'}</strong>
                          <span className="held-item-sku">{item.productSku || '—'}</span>
                        </td>
                        <td className="erp-table-cell">
                          <span className="held-wh-badge">{item.warehouseName || 'Default'}</span>
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {item.quantity}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          Rs. {unitPrice.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                          Rs. {lineTotal.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {(!preview?.items || preview.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="erp-table-cell" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                        No line items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Packing Quantities Card */}
          <section className="held-invoice-packing" aria-labelledby="held-packing-title">
            <div className="held-packing-header">
              <div className="held-packing-title-wrap">
                <Package size={16} className="held-packing-icon" />
                <h3 id="held-packing-title">Packing Quantities</h3>
              </div>
              {!automaticPacking && <button
                type="button"
                className="held-quick-zero-btn"
                onClick={handleFillAllZero}
                title="Fill all packing counts with 0"
                disabled={busy}
              >
                <Sparkles size={13} /> Set All to 0
              </button>}
            </div>
            <p className="held-packing-instruction">
              {automaticPacking?'Combined counts from the selected warehouse-reviewed bills.':<>Enter quantity for each packaging unit. Enter <strong>0</strong> for any unused type.</>}
            </p>

            <div className="held-invoice-packing-fields">
              {fields.map(([key, label], index) => {
                const val = packing[key];
                const isFilled = /^\d+$/.test(val);
                return (
                  <label key={key} htmlFor={`packing-${key}`} className={`held-packing-field ${isFilled ? 'is-valid' : ''}`}>
                    <span className="held-field-label">{label}</span>
                    <input
                      ref={index === 0 ? first : undefined}
                      id={`packing-${key}`}
                      className="erp-field held-packing-input"
                      type="number"
                      min="0"
                      max={automaticPacking?100000000:1000000}
                      step="1"
                      inputMode="numeric"
                      required
                      disabled={busy}
                      readOnly={Boolean(automaticPacking)}
                      value={packing[key]}
                      placeholder="0"
                      onChange={(event) =>
                        setPacking((previous) => ({
                          ...previous,
                          [key]: event.target.value
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {/* Total & Delivery Summary Box */}
          <div className="held-invoice-total-card">
            <div className="held-total-left">
              <span className="held-total-label">Invoice Grand Total</span>
              <div className="held-total-status-badges">
                <span className="held-status-pill pending-payment">
                  <span className="held-status-dot" /> Payment Pending
                </span>
                <span className="held-status-pill pending-delivery">
                  <span className="held-status-dot" /> Delivery Pending
                </span>
              </div>
            </div>
            <div className="held-total-right">
              <span className="held-currency-tag">LKR</span>
              <strong className="held-grand-total">
                {Number(preview?.totalAmount || 0).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </strong>
            </div>
          </div>

          {error && (
            <div className="held-invoice-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="held-invoice-footer">
          <button
            type="button"
            className="erp-button btn-glass held-btn-cancel"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="erp-button erp-button-primary held-btn-submit"
            disabled={busy || !valid}
          >
            {busy ? (
              'Creating…'
            ) : (
              <>
                <Check size={16} /> Create Invoice
              </>
            )}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}
