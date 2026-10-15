import React from 'react';
import RecordDetailsModal from './RecordDetailsModal';
import RecordActions from './RecordActions';
import {masterNames,recordStatus} from '../utils/masterRecordLifecycle';
import {printA4Report} from '../utils/printReport';
import './PurchaseInspectionModal.css';
import './MasterDetailsModal.css';

const money=value=>value==null?'—':`LKR ${Number(value).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const escapeText=value=>String(value ?? '—').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export default function MasterDetailsModal({record,type,brandName,warehouseName,onClose,onEdit,onStatusChange,onDelete,canManage=false}) {
 const name=masterNames[type],status=recordStatus(record),code=record.sku || record.code || '—';
 const details=type==='products'?[
  ['Brand',brandName],['Category',record.categoryName],['Warehouse',warehouseName],['Unit of measure',record.unitOfMeasure],
  ['Minimum stock level',record.minStockLevel],['Cost price',money(record.costPrice)],['Selling price',money(record.sellingPrice)],
  ['Remarks',record.description,true],
 ]:type==='warehouses'?[
  ['Address',record.address,true],['Contact person',record.contactPerson],['Contact number',record.contactNumber || record.phone],['Remarks',record.remarks,true],
 ]:type==='brands'?[
  ['MP% (Markup on cost)',`${Number(record.markupPercent || 0).toLocaleString()}%`],['Remarks',record.description,true],
 ]:[['Remarks',record.description,true]];
 const print=()=>printA4Report({title:`${name} Details`,metaItems:[{label:'Name',value:escapeText(record.name)},{label:'Code',value:escapeText(code)},{label:'Status',value:status}],columns:[{header:'Field',accessor:'field',width:'35%'},{header:'Details',accessor:'value'}],data:details.map(([field,value])=>({field,value:escapeText(value)}))});
 return <RecordDetailsModal label={`${name} details`} title={record.name || `${name} details`} subtitle={`${name} · ${code}`} status={status} details={details} onClose={onClose} onPrint={print} className={`master-details-${type} master-details-uniform`}
  actions={<RecordActions name={name} status={status} canManage={canManage} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} className="master-details-management"/>}/>;
}
