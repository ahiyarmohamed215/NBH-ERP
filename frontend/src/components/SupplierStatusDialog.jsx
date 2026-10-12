import React from 'react';
import {AlertTriangle,CheckCircle,X} from 'lucide-react';
import './SupplierStatusDialog.css';
import './PurchasingAppearance.css';

export default function SupplierStatusDialog({pending,reason,onReasonChange,busy,onClose,onConfirm}) {
  const deactivate=pending.target==='INACTIVE';
  const Icon=deactivate?AlertTriangle:CheckCircle;
  return <div className="modal-backdrop purchasing-no-shadows" style={{padding:12,zIndex:1300}}>
    <div className={`glass-modal supplier-status-dialog ${deactivate?'supplier-status-deactivate':'supplier-status-activate'}`} role="dialog" aria-modal="true" aria-label="Change Supplier status">
      <header><Icon size={24}/><h3>{deactivate?'Deactivate':'Activate'} supplier</h3><button type="button" aria-label="Close status change" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      <div className="supplier-status-summary"><strong>{pending.number}</strong><span>{pending.current==='ACTIVE'?'Active':'Inactive'} → {deactivate?'Inactive':'Active'}</span><p>Enter the reason for this change. It will be recorded in the audit log.</p></div>
      <label>Reason for {deactivate?'Deactivation':'Activation'} <span>*</span><textarea autoFocus aria-label="Status change reason" maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event=>onReasonChange(event.target.value)} placeholder={`Enter reason for ${deactivate?'deactivation':'activation'}...`}/></label>
      <footer><button type="button" className="btn btn-glass" disabled={busy} onClick={onClose}>Close</button><button type="button" className="supplier-status-confirm" aria-label="Confirm status change" disabled={busy || !reason.trim()} onClick={onConfirm}>{busy?'Updating...':`Confirm ${deactivate?'Deactivation':'Activation'}`}</button></footer>
    </div>
  </div>;
}
