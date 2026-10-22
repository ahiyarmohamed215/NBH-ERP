import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {FileText,X} from 'lucide-react';
import './HeldInvoiceDialog.css';
const fields=[['boxes','Box'],['bags','Bag'],['pBags','P. Bag'],['others','Others']];
export default function HeldInvoiceDialog({preview,busy=false,error,onClose,onConfirm}) {
 const [packing,setPacking]=useState({boxes:'',bags:'',pBags:'',others:''});
 const dialog=useRef(null),first=useRef(null);
 const valid=fields.every(([key])=>/^\d+$/.test(packing[key]) && Number(packing[key])<=1000000);
 useEffect(()=>{const previous=document.activeElement;first.current?.focus();return()=>previous?.focus?.();},[]);
 const keydown=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!busy)onClose();}
  if(event.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
 };
 return createPortal(<div className="modal-backdrop held-invoice-backdrop"><form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="held-invoice-title" className="held-invoice-dialog purchasing-no-shadows" onKeyDown={keydown} onSubmit={event=>{event.preventDefault();if(valid && !busy)onConfirm(Object.fromEntries(fields.map(([key])=>[key,Number(packing[key])])));}}>
  <header><div className="held-invoice-heading"><FileText size={22}/><div><h2 id="held-invoice-title" className="erp-dialog-title">Create Invoice</h2><p>Review adjusted bills and enter packing quantities.</p></div></div><button type="button" className="purchase-inspection-close" aria-label="Close create invoice" disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className="held-invoice-body">
   <dl className="held-invoice-summary"><div><dt>Customer</dt><dd>{preview.customerName}</dd></div><div><dt>Onhold bills</dt><dd>{preview.sourceBills?.join(', ')}</dd></div><div><dt>Invoice date</dt><dd>{preview.date}</dd></div></dl>
   <div className="erp-table-frame erp-table-scroll held-invoice-items"><table className="erp-table"><thead><tr>{['Product','Warehouse','Quantity','Line total'].map(label=><th key={label} className="erp-table-heading">{label}</th>)}</tr></thead><tbody>{(preview.items || []).map((item,index)=><tr key={index}><td className="erp-table-cell"><strong>{item.productName}</strong><small>{item.productSku}</small></td><td className="erp-table-cell">{item.warehouseName || '—'}</td><td className="erp-table-cell">{item.quantity}</td><td className="erp-table-cell">Rs. {Number(item.totalPrice ?? item.quantity*item.unitPrice).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table></div>
   <section className="held-invoice-packing" aria-labelledby="held-packing-title"><h3 id="held-packing-title">Packing quantities</h3><p>Enter 0 for any packing type that is not used.</p><div className="held-invoice-packing-fields">{fields.map(([key,label],index)=><label key={key} htmlFor={`packing-${key}`}><span>{label}</span><input ref={index===0?first:undefined} id={`packing-${key}`} className="erp-field" type="number" min="0" max="1000000" step="1" inputMode="numeric" required disabled={busy} value={packing[key]} placeholder="0" onChange={event=>setPacking(previous=>({...previous,[key]:event.target.value}))}/></label>)}</div></section>
   <div className="held-invoice-total"><span>Invoice total</span><strong>Rs. {Number(preview.totalAmount || 0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
   <p className="held-invoice-note">Payment Pending · Delivery Pending</p>
   {error && <p className="held-invoice-error" role="alert">{error}</p>}
  </div><footer><button type="button" className="erp-button btn-glass" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="erp-button erp-button-primary" disabled={busy || !valid}>{busy?'Creating…':'Create Invoice'}</button></footer>
 </form></div>,document.body);
}
