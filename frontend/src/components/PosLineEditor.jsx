import React from "react";
import { X } from "lucide-react";
import { posMoney } from "./PosRangeProgress";
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
            <h2 id="pos-line-title">Edit bill item</h2>
            <p>
              {item.sku} · {item.name}
            </p>
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
          <div className="pos-range-summary">
            <div>
              <span>Unit price</span>
              <strong>{posMoney(item.unitPrice)}</strong>
            </div>
            <div>
              <span>Available for this bill</span>
              <strong>{item.availableQty}</strong>
            </div>
          </div>
          <div className="pos-edit-fields">
            <label>
              Quantity
              <input
                autoFocus
                required
                type="number"
                min="0.01"
                step="0.01"
                max={item.availableQty}
                className="input-glass erp-field"
                value={item.editQty}
                onChange={(e) => onQty(e.target.value)}
              />
            </label>
            <label>
              Discount (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input-glass erp-field"
                value={item.editDiscRate}
                onChange={(e) => onRate(e.target.value)}
              />
            </label>
            <label>
              Discount (Rs.)
              <input
                type="number"
                min="0"
                max={item.editQty * item.unitPrice}
                step="0.01"
                className="input-glass erp-field"
                value={item.editDiscAmt}
                onChange={(e) => onAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="pos-split pos-line-total">
            <span>Line total</span>
            <strong>{posMoney(item.editTotal)}</strong>
          </div>
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
