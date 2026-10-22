import React from "react";
import { X } from "lucide-react";
import { posMoney } from "./PosRangeProgress";
import './PosLineEditor.css';
export default function PosLineEditor({
  item,
  busy,
  onQty,
  onRate,
  onAmount,
  onSave,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop pos-overlay"
      onClick={busy ? undefined : onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-line-title"
        className="pos-dialog pos-line-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <header className="pos-dialog-heading">
          <div>
            <h2 id="pos-line-title">Edit product</h2>
          </div>
          <button
            type="button"
            className="erp-table-icon-action"
            aria-label="Close item editor"
            disabled={busy}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="pos-dialog-body">
          <div className="pos-line-identity">
            <strong className="pos-line-product">{item.name}</strong>
            <span className="pos-line-code">{item.sku}</span>
          </div>
          <dl className="pos-line-facts">
            <div>
              <dt>Unit price</dt>
              <dd>{posMoney(item.unitPrice)}</dd>
            </div>
            <div>
              <dt>Available quantity</dt>
              <dd>{item.availableQty}</dd>
            </div>
          </dl>
          <div className="pos-edit-fields">
            <label>
              Selling quantity
              <input
                autoFocus
                required
                disabled={busy}
                type="number"
                min="0.01"
                step="0.01"
                max={item.availableQty}
                className="input-glass erp-field"
                value={item.editQty ?? ''}
                onFocus={event=>event.target.select()}
                onChange={(e) => onQty(e.target.value)}
              />
            </label>
            <label>
              Discount (%)
              <input
                disabled={busy}
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input-glass erp-field"
                value={item.editDiscRate ?? ''}
                onChange={(e) => onRate(e.target.value)}
              />
            </label>
            <label>
              Discount (Rs.)
              <input
                disabled={busy}
                type="number"
                min="0"
                max={item.editQty * item.unitPrice}
                step="0.01"
                className="input-glass erp-field"
                value={item.editDiscAmt ?? ''}
                onChange={(e) => onAmount(e.target.value)}
              />
            </label>
          </div>
          <dl className="pos-line-summary">
            <div><dt>Total before discount</dt><dd>{posMoney(Number(item.editQty || 0) * Number(item.unitPrice || 0))}</dd></div>
            <div><dt>Discount</dt><dd>{posMoney(item.editDiscAmt)}</dd></div>
            <div><dt>Line total</dt><dd>{posMoney(item.editTotal)}</dd></div>
          </dl>
        </div>
        <footer className="pos-dialog-footer">
          <button
            type="button"
            className="btn btn-secondary erp-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary erp-button"
            disabled={busy}
          >
            {busy ? "Saving…" : "Update item"}
          </button>
        </footer>
      </form>
    </div>
  );
}
