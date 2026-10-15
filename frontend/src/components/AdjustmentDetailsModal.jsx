import React from 'react';
import {Edit2} from 'lucide-react';
import RecordDetailsModal from './RecordDetailsModal';
import {printA4Report} from '../utils/printReport';

const escapeText=value=>String(value ?? '—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default function AdjustmentDetailsModal({record,onClose,onEdit,canManage}) {
 const quantity=Number(record.quantity || 0),signedQuantity=`${quantity>0?'+':''}${quantity.toLocaleString()}`;
 const details=[['Record number',record.recordNo],['Date',record.date],['Warehouse',record.warehouse],['Product code',record.sku],['Batch number',record.batch],['Quantity adjusted',signedQuantity],['Reason',record.reason,true]];
 const print=()=>printA4Report({title:'Stock Adjustment',metaItems:[{label:'Product',value:escapeText(record.productName)},{label:'Adjustment type',value:escapeText(record.type)}],columns:[{header:'Field',accessor:'field'},{header:'Details',accessor:'value'}],data:details.map(([field,value])=>({field,value:escapeText(value)}))});
 return <RecordDetailsModal label="Stock adjustment details" title={record.productName || 'Stock adjustment'} subtitle={`Stock adjustment · ${record.recordNo || '—'}`} details={details} onClose={onClose} onPrint={print}
  badge={<span className={`erp-status-badge erp-status-${quantity>0?'success':'inactive'}`}>{record.type || 'Adjustment'}</span>}
  actions={canManage && <div className="purchase-inspection-detail-actions record-actions master-details-management"><button type="button" className="btn btn-glass erp-button" aria-label="Edit Adjustment" onClick={onEdit}><Edit2 size={14}/> Edit Adjustment</button></div>}/>;
}
