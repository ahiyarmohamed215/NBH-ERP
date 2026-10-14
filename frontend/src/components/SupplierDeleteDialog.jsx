import React from 'react';
import { Trash2, X } from 'lucide-react';
import './SupplierStatusDialog.css';

export default function SupplierDeleteDialog({ supplier, permanent = false, busy, onClose, onConfirm }) {
  const title = permanent ? 'Permanently delete supplier' : 'Delete supplier';
  return <div className="modal-backdrop purchasing-no-shadows" style={{padding:12,zIndex:1300}} onClick={() => !busy && onClose()}>
    <section className="glass-modal supplier-status-dialog supplier-status-deactivate" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <header><div className="purchasing-status-symbol"><Trash2 size={19}/></div><h3>{title}</h3><button type="button" aria-label="Close deletion confirmation" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      <div className="purchasing-status-body"><p><strong>{supplier.name || supplier.supplierCode}</strong></p>
      <p className="purchasing-status-description">{permanent ? 'This supplier will be removed from the recycle bin and cannot be restored. Contact details will be erased. Existing records keep the supplier name and a deleted label.' : 'This supplier will move to the recycle bin. You can restore it later. Existing records and operations will keep their supplier reference.'}</p></div>
      <footer><button type="button" className="btn btn-glass erp-button" autoFocus disabled={busy} onClick={onClose}>Back</button><button type="button" className="supplier-status-confirm" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : permanent ? 'Delete permanently' : 'Move to recycle bin'}</button></footer>
    </section>
  </div>;
}
