import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Trophy,X} from 'lucide-react';
import PosStaffPerformance from './PosStaffPerformance';
import MonthFilter,{currentBusinessMonth} from './MonthFilter';
import './PurchaseInspectionModal.css';
export default function PosPerformanceDialog({user,onClose}) {
 const [month,setMonth]=useState(currentBusinessMonth),dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement;dialog.current?.querySelector('[aria-label="Close performance"]')?.focus();const key=event=>{
  if(document.querySelector('[aria-label="Staff performance details"]'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
  if(event.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
 };document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus?.();};},[]);
 return createPortal(<div className="modal-backdrop pos-performance-backdrop" onClick={onClose}><section ref={dialog} className="purchase-inspection pos-performance-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-performance-title" onClick={event=>event.stopPropagation()}>
  <header className="purchase-inspection-header"><div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Trophy size={22} strokeWidth={1.7}/></div><h2 id="pos-performance-title" className="erp-dialog-title">Staff Rankings</h2></div><div className="pos-performance-header-actions"><MonthFilter label="Performance month" value={month} onChange={setMonth}/><button type="button" className="purchase-inspection-close" aria-label="Close performance" onClick={onClose}><X size={18}/></button></div></header>
  <div className="pos-performance-body"><PosStaffPerformance user={user} month={month} showMonthFilter={false}/></div>
 </section></div>,document.body);
}
