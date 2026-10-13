import StatusBadge from './StatusBadge';
import React from 'react';
import {Truck,UserRound,Phone,Mail,MapPin,Edit2,Printer,X,Ban,CheckCircle} from 'lucide-react';
import './PurchaseInspectionModal.css';
import './SupplierDetailsModal.css';

export default function SupplierDetailsModal({supplier,active,onClose,onPrint,onEdit,onStatusChange,canManage=true}) {
  const status=supplier.status || (active?'ACTIVE':'INACTIVE');
  const details=[
    {label:'Supplier name',value:supplier.name,icon:Truck},
    {label:'Contact person',value:supplier.contactPerson,icon:UserRound},
    {label:'Phone',value:supplier.phone,icon:Phone},
    {label:'Email',value:supplier.email,icon:Mail},
    {label:'Address',value:supplier.address,icon:MapPin,wide:true},
  ];
  return <div className="modal-backdrop purchasing-no-shadows" style={{padding:12,zIndex:1100}}>
    <div className="glass-modal purchase-inspection supplier-inspection purchase-inspection-bottom-actions" role="dialog" aria-modal="true" aria-label="Supplier details">
      <header className="purchase-inspection-header purchase-inspection-header-details">
        <div className="purchase-inspection-header-main">
          <div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Truck size={22} strokeWidth={1.7}/></div><div><span className="purchase-inspection-caption">Supplier details</span><div className="purchase-inspection-number-row"><h2>{supplier.supplierCode || supplier.code || 'Supplier'}</h2><StatusBadge status={status} title={`Status: ${status}`}/></div></div></div>
          <div className="purchase-inspection-header-controls"><button type="button" className="purchase-inspection-close" aria-label="Close supplier details" title="Close" onClick={onClose}><X size={18}/></button></div>
        </div>
        <div className="purchase-inspection-details-card">
          <dl className="purchase-inspection-details" aria-label="Supplier contact details">{details.map(({label,value,icon:Icon,wide})=><div key={label} className={wide?'purchase-inspection-detail-wide':undefined}><dt><Icon size={13} strokeWidth={1.7}/>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
          {canManage && <div className="purchase-inspection-detail-actions">
            {status!=='INACTIVE' && <button type="button" className="btn btn-glass" onClick={onEdit}><Edit2 size={15}/> Edit Supplier</button>}
            {status==='INACTIVE' && <button type="button" className="btn btn-glass purchase-inspection-success" onClick={()=>onStatusChange('ACTIVE')}><CheckCircle size={15}/> Process Supplier</button>}
            {status!=='INACTIVE' && <button type="button" className="btn btn-glass purchase-inspection-danger" onClick={()=>onStatusChange('INACTIVE')}><Ban size={15}/> Cancel Supplier</button>}
          </div>}
        </div>
      </header>
      <aside className="purchase-inspection-actions" aria-label="Supplier actions"><button type="button" className="btn btn-primary" title="Print Supplier Details (A4)" onClick={onPrint}><Printer size={15}/> Print</button><button type="button" className="btn btn-glass" onClick={onClose}>Close</button></aside>
    </div>
  </div>;
}
