import React from 'react';
import RecordDetailsModal from './RecordDetailsModal';
import RecordActions from './RecordActions';
import {printA4Report} from '../utils/printReport';
import './PurchaseInspectionModal.css';

const escapeText=value=>String(value ?? '—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default function AllocationDetailsModal({allocation:q,status,canManage,busy,onClose,onEdit,onStatusChange,onDelete}) {
 const unit=q.productUnit || 'Units',number=value=>value==null?'—':Number(value).toLocaleString(),stock=q.totalStockAvailable ?? q.currentStockInWarehouse;
 const remaining=q.remainingQuantity ?? (q.allocatedQuantity==null?null:Math.max(0,Number(q.allocatedQuantity)-Number(q.soldQuantity || 0)));
 const staff=q.userFullName || q.username || 'Staff not selected';
 const measures=[['Total stock available',stock],['Given to staff',q.allocatedQuantity],['Sold',q.soldQuantity ?? 0],['Remaining limit',remaining]];
 const print=()=>printA4Report({title:'Inventory Allocation',columns:[{header:'Field',accessor:'field'},{header:'Details',accessor:'value'}],data:[['Product',q.productName],['Product code',q.productSku],['Staff member',staff],['Staff code',q.userEmployeeCode],['Warehouse',q.warehouseName],['Status',status],...measures.map(([label,value])=>[label,`${number(value)} ${unit}`]),['Remarks',q.notes]].map(([field,value])=>({field,value:escapeText(value)}))});
 const details=[['Staff member',staff],['Staff code',q.userEmployeeCode || q.username],['Warehouse',q.warehouseName || (q.warehouseId?'—':q.productId?'All warehouses':'Not selected')],...measures.map(([label,value])=>[label,value==null?'—':`${number(value)} ${unit}`]),['Remarks',q.notes,true]];
 return <RecordDetailsModal label="Inventory allocation details" title={q.productName || 'Inventory allocation'} subtitle={`${q.productSku || 'Product not selected'} · Allocation #${q.id}`} status={status} details={details} onClose={onClose} onPrint={print}
  actions={<RecordActions name="Allocation" status={status} canManage={canManage} disabled={busy} activationDisabled={!q.productId || !q.userId || Number(q.allocatedQuantity || 0)<=0} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} className="master-details-management"/>}/>;
}
