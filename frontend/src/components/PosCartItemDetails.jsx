import React from 'react';
import {Edit2,Trash2} from 'lucide-react';
import RecordDetailsModal from './RecordDetailsModal';
import {posMoney} from './PosRangeProgress';
import './PosCartItemDetails.css';

export default function PosCartItemDetails({item,busy,onClose,onEdit,onDelete}) {
  const gross=Number(item.quantity)*Number(item.unitPrice);
  const totalDisc=Math.max(0, gross - Number(item.total != null ? item.total : (gross - Number(item.discountAmount || 0))));
  const rate=gross>0?Number((totalDisc*100/gross).toFixed(2)):0;
  const details=[['Product code',item.sku],['Brand',item.brandName],['Category',item.categoryName],
    ['Warehouse',item.warehouseName || item.warehouseCode],['Quantity',item.quantity],['Unit price',posMoney(item.unitPrice)]];
  const pricing=[['Total before discount',posMoney(gross)],
    ['Discount (%)',`${rate.toLocaleString(undefined,{maximumFractionDigits:2})}%`],['Discount',posMoney(totalDisc)],['Line total',posMoney(item.total)]];
  return <RecordDetailsModal label="Added product details" title={item.name} subtitle="POS · Added product" details={details} onClose={onClose}
    actions={<div className="purchase-inspection-detail-actions master-details-management" aria-label="Added product actions">
      <button type="button" className="btn btn-glass erp-button" disabled={busy} onClick={onEdit}><Edit2 size={14}/>Edit</button>
      <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" disabled={busy} onClick={onDelete}><Trash2 size={14}/>Delete</button>
    </div>}><dl className="pos-cart-pricing-summary" aria-label="Product pricing summary">{pricing.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></RecordDetailsModal>;
}
