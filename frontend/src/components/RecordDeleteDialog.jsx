import React,{useEffect} from 'react';
import {Trash2,X} from 'lucide-react';
import './SupplierStatusDialog.css';
export default function RecordDeleteDialog({record,label='record',permanent=false,busy,onClose,onConfirm}) {
 useEffect(()=>{const close=event=>{if(event.key==='Escape' && !busy)onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[busy,onClose]);
 const title=permanent?`Permanently delete ${label.toLowerCase()}`:`Delete ${label.toLowerCase()}`;
 return <div className="modal-backdrop purchasing-no-shadows" style={{padding:12,zIndex:1300}}><section className="glass-modal supplier-status-dialog supplier-status-deactivate" role="dialog" aria-modal="true" aria-label={title}>
  <header><div className="purchasing-status-symbol"><Trash2 size={19}/></div><h3>{title}</h3><button type="button" disabled={busy} aria-label="Close deletion confirmation" onClick={onClose}><X size={18}/></button></header>
  <div className="purchasing-status-body"><strong>{record.name || record.fullName || record.code || record.supplierCode || record.id}</strong><p className="purchasing-status-description">{permanent?'This record will leave the recycle bin and cannot be restored. Historical references remain available.':'This record will move to the global recycle bin. You can restore it later. Linked history will remain available.'}</p></div>
  <footer><button className="btn btn-glass erp-button" type="button" autoFocus disabled={busy} onClick={onClose}>Back</button><button className="supplier-status-confirm" type="button" disabled={busy} onClick={onConfirm}>{busy?'Deleting…':permanent?'Delete permanently':'Move to recycle bin'}</button></footer>
 </section></div>;
}
