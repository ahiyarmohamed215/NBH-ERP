import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Printer,X,CheckCircle} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import {warehouseGroups,printHeldWarehouseSheets} from '../utils/heldWarehousePrint';
import './HeldBillPrintDialog.css';

export default function HeldBillPrintDialog({bill,onClose,onPrinted}) {
  const groups=warehouseGroups(bill),panel=useRef(null),closeRef=useRef(onClose);
  const [attempted,setAttempted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement;panel.current?.querySelector('button')?.focus();
    return()=>previous?.isConnected && previous.focus();
  },[]);
  useEffect(()=>{
    const keys=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!busy)closeRef.current();}
      if(event.key==='Tab'){
        const nodes=[...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')];
        if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keys,true);return()=>document.removeEventListener('keydown',keys,true);
  },[busy]);
  const print=()=>{setError('');try{printHeldWarehouseSheets(bill);setAttempted(true);}catch(e){setError(e.message || 'Unable to open the print dialog.');}};
  const confirm=async()=>{
    if(busy || !attempted)return;setBusy(true);setError('');
    try{const response=await salesApi.printHeld(bill.id);await onPrinted(response.data?.data || response.data);}
    catch(e){setError(e.response?.data?.message || e.message || 'Unable to confirm printing. Try again.');}
    finally{setBusy(false);}
  };
  return createPortal(<div className="modal-backdrop held-print-backdrop"><section ref={panel} className="glass-modal held-print-dialog" role="dialog" aria-modal="true" aria-label="Print Onhold Bill">
    <header><div><h2 className="erp-dialog-title">Print Onhold Bill</h2><p>{bill.heldNumber} · {bill.customerName}</p></div><button type="button" className="erp-table-icon-action" aria-label="Close onhold print popup" onClick={onClose} disabled={busy}><X size={18}/></button></header>
    <div className="held-print-body"><p>Choose your office printer and A4 paper. Each warehouse starts on a separate sheet with only its products.</p>
      <div className="erp-table-frame erp-table-scroll"><table className="erp-table"><thead><tr><th className="erp-table-heading">Warehouse</th><th className="erp-table-heading">Products</th></tr></thead><tbody>{groups.map(group=><tr key={group.id}><td className="erp-table-cell">{group.name || `Warehouse ${group.id}`}</td><td className="erp-table-cell">{group.items.length}</td></tr>)}</tbody></table></div>
      <p className="held-print-help">The bill stays Yet to Print until you confirm all warehouse sheets printed successfully. If printing was cancelled or failed, print again or choose Print Later.</p>
      {error && <p className="held-print-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-glass held-print-primary" disabled={busy || !groups.length} onClick={print}><Printer size={16}/>Print All Warehouse Sheets</button>
    </div>
    <footer><button type="button" className="btn btn-glass" disabled={busy} onClick={onClose}>Print Later</button><button type="button" className="btn btn-glass held-print-primary" aria-label="Confirm warehouse sheets printed" disabled={busy || !attempted} onClick={confirm}><CheckCircle size={16}/>{busy?'Saving...':'Printed — Send to Warehouse'}</button></footer>
  </section></div>,document.body);
}
