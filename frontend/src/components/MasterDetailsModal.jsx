import React,{useEffect,useRef} from 'react';
import {X,Edit2,Printer,Trash2,Ban,CheckCircle,RotateCcw} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {masterNames,recordStatus} from '../utils/masterRecordLifecycle';
import {printA4Report} from '../utils/printReport';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

const money=value=>value==null?'—':`LKR ${Number(value).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const escapeText=value=>String(value ?? '—').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export default function MasterDetailsModal({record,type,brandName,warehouseName,onClose,onEdit,onStatusChange,onDelete,canManage=false}) {
 const name=masterNames[type],status=recordStatus(record),code=record.sku || record.code || '—',dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 const details=type==='products'?[
  ['Brand',brandName],['Category',record.categoryName],['Warehouse',warehouseName],['Unit of measure',record.unitOfMeasure],
  ['Minimum stock level',record.minStockLevel],['Cost price',money(record.costPrice)],['Selling price',money(record.sellingPrice)],
  ['Description / notes',record.description,true],
 ]:type==='warehouses'?[
  ['Contact person',record.contactPerson],['Contact number',record.contactNumber || record.phone],['Address',record.address,true],
 ]:type==='brands'?[
  ['MP% (Markup on cost)',`${Number(record.markupPercent || 0).toLocaleString()}%`],['Description / notes',record.description,true],
 ]:[['Description / notes',record.description,true]];
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
 const print=()=>printA4Report({title:`${name} Details`,metaItems:[{label:'Name',value:escapeText(record.name)},{label:'Code',value:escapeText(code)},{label:'Status',value:status}],columns:[{header:'Field',accessor:'field',width:'35%'},{header:'Details',accessor:'value'}],data:details.map(([field,value])=>({field,value:escapeText(value)}))});
 return <div className="modal-backdrop purchasing-no-shadows master-details-backdrop" onClick={onClose}>
  <section ref={dialog} className={`glass-modal purchase-inspection master-details-modal master-details-${type}`} role="dialog" aria-modal="true" aria-label={`${name} details`} onClick={event=>event.stopPropagation()}>
   <header className="purchase-inspection-header"><div className="purchase-inspection-title"><h2 className="erp-dialog-title">{record.name || `${name} details`}</h2><div className="master-details-meta"><span>{name} · {code}</span><StatusBadge status={status}/></div></div><button data-close type="button" className="master-details-close" aria-label={`Close ${name.toLowerCase()} details`} onClick={onClose}><X size={18}/></button></header>
   <div className="master-details-body"><dl className="purchase-inspection-details master-details-grid">{details.map(([label,value,wide])=><div key={label} className={wide?'master-details-wide':undefined}><dt>{label}</dt><dd>{value==null || value===''?'—':value}</dd></div>)}</dl></div>
    {canManage && <div className="purchase-inspection-detail-actions master-details-management" aria-label={`${name} management actions`}>
     <button type="button" className="btn btn-glass erp-button" onClick={onEdit}><Edit2 size={14}/> Edit {name}</button>
     {status==='ACTIVE'?<button type="button" className="btn btn-glass erp-button purchase-inspection-danger" onClick={()=>onStatusChange('INACTIVE')}><Ban size={14}/> Deactivate {name}</button>:<button type="button" className="btn btn-glass erp-button purchase-inspection-success" onClick={()=>onStatusChange('ACTIVE')}><CheckCircle size={14}/> {status==='INACTIVE'?'Reactivate':'Activate'} {name}</button>}
     {status!=='DRAFT' && <button type="button" className="btn btn-glass erp-button" onClick={()=>onStatusChange('DRAFT')}><RotateCcw size={14}/> Return to draft</button>}
     {onDelete && <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" onClick={onDelete}><Trash2 size={14}/> Delete {name}</button>}
    </div>}
   <footer className="master-details-footer"><button type="button" className="btn btn-glass erp-button" onClick={print}><Printer size={14}/> Print</button><button type="button" className="btn btn-glass erp-button" onClick={onClose}>Close</button></footer>
  </section>
 </div>;
}
