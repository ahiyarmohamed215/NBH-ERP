import React, {useEffect,useRef} from 'react';
import {Edit2,Printer,X,Ban,CheckCircle,Trash2} from 'lucide-react';
import StatusBadge from './StatusBadge';
import './PurchaseInspectionModal.css';
import './SupplierDetailsModal.css';

export default function SupplierDetailsModal({supplier={},active,onClose,onPrint,onEdit,onStatusChange,onDelete,canManage=true}) {
  const dialogRef=useRef(null);
  const status=supplier.status || (active?'ACTIVE':'INACTIVE');
  useEffect(()=>{
    const previous=document.activeElement;
    dialogRef.current?.querySelector('.supplier-card-close')?.focus();
    const keydown=event=>{
      const dialogs=[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if(dialogs.at(-1)!==dialogRef.current)return;
      if(event.key==='Escape' && !event.defaultPrevented){event.stopPropagation();onClose();}
      if(event.key==='Tab'){
        const controls=[...dialogRef.current.querySelectorAll('button:not(:disabled),a[href]')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',keydown);
    return()=>{window.removeEventListener('keydown',keydown);previous?.focus?.();};
  },[onClose]);
  return <div className="modal-backdrop purchasing-no-shadows supplier-card-backdrop" style={{padding:12,zIndex:1100}} onClick={onClose}>
    <section ref={dialogRef} className="glass-modal purchase-inspection supplier-inspection supplier-floating-card supplier-minimal-dialog" role="dialog" aria-modal="true" aria-label="Supplier details" onClick={event=>event.stopPropagation()}>
      <header className="supplier-card-topbar">
        <div className="supplier-card-name-block"><h2 className="erp-dialog-title supplier-card-name">{supplier.name || '—'}</h2><div className="supplier-card-meta-row"><span className="supplier-card-code">{supplier.supplierCode || supplier.code || '—'}</span><StatusBadge status={status}/></div></div>
        <button type="button" className="supplier-card-close" aria-label="Close supplier details" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="purchase-inspection-details-card supplier-card-body">
        <dl className="purchase-inspection-details supplier-card-details" aria-label="Supplier contact details">
          <div className="supplier-card-row"><dt>Contact person</dt><dd>{supplier.contactPerson || '—'}</dd></div>
          <div className="supplier-card-row"><dt>Phone</dt><dd>{supplier.phone?<a className="supplier-card-link" href={'tel:'+supplier.phone}>{supplier.phone}</a>:'—'}</dd></div>
          <div className="supplier-card-row"><dt>Email</dt><dd>{supplier.email?<a className="supplier-card-link" href={'mailto:'+supplier.email}>{supplier.email}</a>:'—'}</dd></div>
          <div className="supplier-card-row"><dt>Address</dt><dd>{supplier.address || '—'}</dd></div>
        </dl>
        {canManage && <div className="purchase-inspection-detail-actions supplier-card-actions">
          <button type="button" className="btn btn-glass erp-button" onClick={onEdit}><Edit2 size={14}/> Edit Supplier</button>
          {status==='ACTIVE'?<button type="button" className="btn btn-glass purchase-inspection-danger erp-button" onClick={()=>onStatusChange('INACTIVE')}><Ban size={14}/> Deactivate Supplier</button>:<button type="button" className="btn btn-glass purchase-inspection-success erp-button" onClick={()=>onStatusChange('ACTIVE')}><CheckCircle size={14}/> {status==='INACTIVE'?'Reactivate Supplier':'Activate Supplier'}</button>}
          {onDelete && <button type="button" className="btn btn-glass purchase-inspection-danger erp-button" onClick={onDelete}><Trash2 size={14}/> Delete Supplier</button>}
        </div>}
      </div>
      <footer className="supplier-card-footer" aria-label="Supplier actions"><button type="button" className="btn btn-glass erp-button" title="Print Supplier Details (A4)" onClick={onPrint}><Printer size={14}/> Print</button><button type="button" className="btn btn-glass erp-button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
