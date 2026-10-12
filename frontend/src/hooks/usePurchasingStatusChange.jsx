import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import '../components/PurchaseDocument.css';

export function usePurchasingStatusChange() {
  const [pending,setPending]=useState(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const {addToast}=useToast();
  const requestStatusChange=config=>{setReason('');setPending(config);};
  const confirm=async()=>{
    if(busy || !pending || !reason.trim()) return;
    setBusy(true);
    try { if(await pending.onConfirm(reason.trim()) !== false) setPending(null); }
    catch(error) {addToast(error.response?.data?.message || error.message || 'Status change failed','error');}
    finally {setBusy(false);}
  };
  const statusChangeDialog=pending && <div className="modal-backdrop" style={{zIndex:1300,padding:16}}>
    <div className="glass-modal gtn-status-dialog" role="dialog" aria-modal="true" aria-label={`Change ${pending.type} status`}>
      <header><div><h2>Change {pending.type} status</h2><p>{pending.number} · {pending.current} → {pending.target}</p></div><button type="button" aria-label="Close status change" disabled={busy} onClick={()=>setPending(null)}><X size={18}/></button></header>
      <p>{pending.description || 'Enter a reason for this status change. It will be recorded in the audit log.'}</p>
      <label>Reason / remarks *<textarea autoFocus aria-label="Status change reason" maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)} placeholder="Explain why this status needs to change..."/></label>
      <footer><button type="button" className="btn btn-glass" disabled={busy} onClick={()=>setPending(null)}>Back</button><button type="button" className="btn btn-primary" disabled={busy || !reason.trim()} onClick={confirm}>{busy?'Updating...':'Confirm status change'}</button></footer>
    </div>
  </div>;
  return {requestStatusChange,statusChangeDialog};
}
