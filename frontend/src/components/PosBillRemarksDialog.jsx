import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {posMoney} from './PosRangeProgress';
import './HeldBillPrintDialog.css';
import './PosBillRemarksDialog.css';

export default function PosBillRemarksDialog({customerName,total,busy,onClose,onConfirm}) {
  const [remarks,setRemarks]=useState(''),[error,setError]=useState('');
  const panel=useRef(null),input=useRef(null),submitting=useRef(false),latest=useRef();
  latest.current={busy,onClose};
  useEffect(()=>{
    const previous=document.activeElement;input.current?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!latest.current.busy && !submitting.current)latest.current.onClose();}
      if(event.key==='Tab'){
        const controls=[...panel.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(!first){event.preventDefault();return;}
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{document.removeEventListener('keydown',keydown,true);if(previous?.isConnected)previous.focus();};
  },[]);
  const submit=async event=>{
    event.preventDefault();if(busy || submitting.current)return;
    submitting.current=true;setError('');
    try{if(await onConfirm(remarks.trim())===false)setError('The bill was not saved. Your products and remarks are kept. Try again.');}
    finally{submitting.current=false;}
  };
  return createPortal(<div className="modal-backdrop held-print-backdrop"><form ref={panel} className="glass-modal held-print-dialog pos-bill-remarks" role="dialog" aria-modal="true" aria-labelledby="pos-bill-remarks-title" aria-describedby="pos-bill-remarks-help" onSubmit={submit}>
    <header><div><h2 id="pos-bill-remarks-title" className="erp-dialog-title">Bill remarks</h2><p>{customerName} · {posMoney(total)}</p></div><button type="button" aria-label="Close bill remarks" disabled={busy} onClick={onClose}><X size={18}/></button></header>
    <div className="held-print-body"><p id="pos-bill-remarks-help">Add delivery instructions or other details for this bill. You can leave this blank.</p>
      <label htmlFor="pos-bill-remarks">Remarks (optional)</label><textarea ref={input} id="pos-bill-remarks" className="erp-field" rows={4} maxLength={1000} value={remarks} disabled={busy} onChange={event=>setRemarks(event.target.value)} placeholder="For example: Deliver after 3 pm"/>
      <span className="pos-bill-remarks-count">{remarks.length}/1000</span>{error && <p className="held-print-error" role="alert">{error}</p>}
    </div>
    <footer><button type="button" className="erp-button" disabled={busy} onClick={onClose}>Back to bill</button><button type="submit" className="erp-button held-print-primary" disabled={busy}>{busy?'Saving…':'Save Onhold Bill'}</button></footer>
  </form></div>,document.body);
}
