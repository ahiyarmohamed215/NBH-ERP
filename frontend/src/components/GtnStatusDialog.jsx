import React from 'react';
import { X } from 'lucide-react';

export default function GtnStatusDialog({ document, target, reason, onReasonChange, confirmed, onConfirmChange, busy, onClose, onSave }) {
  const reversesStock = document.status === 'TRANSFERRED' && target !== 'TRANSFERRED';
  return <div className="modal-backdrop" style={{zIndex:1200,padding:16}}>
    <div className="glass-modal gtn-status-dialog" role="dialog" aria-modal="true" aria-label="Change GTN status">
      <header><div><h2>Change GTN status</h2><p>{document.gtnNumber} · {document.status} → {target}</p></div><button type="button" aria-label="Close status change" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      <p>{reversesStock ? 'Transferred quantities will return to the source warehouse. Enough available stock must remain at the destination.' : target === 'TRANSFERRED' ? 'Inventory will move from the source to the destination after confirmation.' : 'This change does not move inventory.'}</p>
      <label>Reason *<textarea aria-label="Status change reason" maxLength={1000} rows={3} value={reason} onChange={event=>onReasonChange(event.target.value)} placeholder="Explain why this status needs to change..." disabled={busy}/></label>
      {target === 'TRANSFERRED' && <label className="gtn-receipt-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>onConfirmChange(event.target.checked)}/> Signed copy returned; all products received</label>}
      <footer><button type="button" className="btn btn-glass" disabled={busy} onClick={onClose}>Back</button><button type="button" className="btn btn-primary" disabled={busy || !reason.trim() || (target === 'TRANSFERRED' && !confirmed)} onClick={onSave}>{busy ? 'Updating...' : 'Confirm status change'}</button></footer>
    </div>
  </div>;
}
