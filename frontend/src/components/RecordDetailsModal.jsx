import React,{useEffect,useRef} from 'react';
import {X,Printer} from 'lucide-react';
import StatusBadge from './StatusBadge';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

export default function RecordDetailsModal({label,title,subtitle,status,badge,details,onClose,onPrint,printTitle,actions,className='',compact=true,allowDraftPrint=false}) {
 const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement;dialog.current?.querySelector('[data-close]')?.focus();
  const keydown=event=>{
   if([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==dialog.current)return;
   if(event.key==='Escape' && !event.defaultPrevented){event.stopPropagation();close.current();}
   if(event.key==='Tab'){
    const controls=[...dialog.current.querySelectorAll('button:not(:disabled),a[href]')],first=controls[0],last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  window.addEventListener('keydown',keydown);return()=>{window.removeEventListener('keydown',keydown);previous?.focus?.();};
 },[]);
 return <div className="modal-backdrop purchasing-no-shadows master-details-backdrop" onClick={onClose}>
  <section ref={dialog} className={`glass-modal purchase-inspection master-details-modal ${compact?'record-details-compact':''} ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={event=>event.stopPropagation()}>
   <header className="purchase-inspection-header"><div className="purchase-inspection-title"><div className="master-details-heading"><h2 className="erp-dialog-title">{title}</h2>{badge || (status && <StatusBadge status={status}/>)}</div><div className="master-details-meta"><span>{subtitle}</span></div></div><button data-close type="button" className="master-details-close" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={18}/></button></header>
   <div className="master-details-body"><dl className="purchase-inspection-details master-details-grid">{details.map(([name,value,wide])=><div key={name} className={wide?'master-details-wide':undefined}><dt>{name}</dt><dd>{value==null || value===''?'—':value}</dd></div>)}</dl></div>
   {actions}
   <footer className="master-details-footer">{onPrint && (allowDraftPrint || status!=='DRAFT') && <button type="button" className="btn btn-glass erp-button" title={printTitle} onClick={onPrint}><Printer size={14}/> Print</button>}<button type="button" className="btn btn-glass erp-button" onClick={onClose}>Close</button></footer>
  </section>
 </div>;
}
