import React from 'react';
import RecordDetailsModal from './RecordDetailsModal';
import RecordActions from './RecordActions';
import './SupplierDetailsModal.css';

export default function SupplierDetailsModal({supplier={},active,onClose,onPrint,onEdit,onStatusChange,onDelete,canManage=true}) {
 const status=supplier.status || (active?'ACTIVE':'INACTIVE');
 const details=[['Contact person',supplier.contactPerson],
  ['Phone',supplier.phone?<a className="supplier-card-link" href={'tel:'+supplier.phone}>{supplier.phone}</a>:null],
  ['Email',supplier.email?<a className="supplier-card-link" href={'mailto:'+supplier.email}>{supplier.email}</a>:null],
  ['Address',supplier.address],['Remarks',supplier.remarks,true]];
 return <RecordDetailsModal label="Supplier details" title={supplier.name || '—'} subtitle={`Supplier · ${supplier.supplierCode || supplier.code || '—'}`} status={status} details={details} onClose={onClose} onPrint={onPrint} printTitle="Print Supplier Details (A4)" className="supplier-inspection supplier-floating-card"
  actions={<RecordActions name="Supplier" status={status} canManage={canManage} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} className="master-details-management supplier-card-actions"/>}/>;
}
