import React from 'react';
import {Printer} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {printDirectoryRow} from '../utils/printDirectory';

export default function InventoryBalanceTable({rows,loading,canSeeCost,onView}) {
 const columns=['Code / Product name','Brand / Category','Warehouse','Qty',...(canSeeCost?['Cost price']:[]),'Selling price','Status','Actions'];
 return <table className="erp-table inventory-balance-table" aria-label="Inventory balances">
  <thead><tr>{columns.map(label=><th key={label} className={`erp-table-heading${label==='Actions'?' erp-table-actions':''}`}>{label}</th>)}</tr></thead>
  <tbody>{loading || !rows.length?<tr><td className="erp-table-cell" colSpan={columns.length}>{loading?'Loading live inventory balances...':'No inventory records found matching current criteria.'}</td></tr>:rows.map(item=>{
   const realQty = Number(item.availableQuantity != null ? item.availableQuantity : (Number(item.quantity || 0) - Number(item.reservedQuantity || 0)));
   const hasReserved = Number(item.reservedQuantity || 0) > 0;
   const minStock = Number(item.minStockLevel || 0);
   const isOut = item.isOutOfStock != null ? item.isOutOfStock : realQty <= 0;
   const isLow = item.isLowStock != null ? item.isLowStock : (!isOut && minStock > 0 && realQty <= minStock);
   const tooltip = hasReserved
     ? `Available to sell: ${realQty.toLocaleString()} ${item.unitOfMeasure || ''} (Reserved in onhold: ${Number(item.reservedQuantity).toLocaleString()}, Physical GRN: ${Number(item.quantity || 0).toLocaleString()})`
     : undefined;

   return (
    <tr key={item.id} onClick={()=>onView(item)} title="Click row to view full stock details">
      <td className="erp-table-cell"><strong className="allocation-list-code">{item.sku || '—'}</strong>{' '}<span className="allocation-list-name">{item.productName || '—'}</span></td>
      <td className="erp-table-cell"><strong className="allocation-list-name">{item.brandName || '—'}</strong>{' '}<span className="allocation-list-secondary">{item.categoryName || '—'}</span></td>
      <td className="erp-table-cell">{item.warehouseName || '—'}</td>
      <td className={`erp-table-cell inventory-stock-quantity${realQty<=0?' inventory-stock-empty':''}`} title={tooltip}>
        {realQty.toLocaleString()} <small>{item.unitOfMeasure}</small>
      </td>
      {canSeeCost && <td className="erp-table-cell">Rs. {Number(item.costPrice || 0).toFixed(2)}</td>}
      <td className="erp-table-cell">Rs. {Number(item.sellingPrice || 0).toFixed(2)}</td>
      <td className="erp-table-cell"><StatusBadge status={isOut?'OUT_OF_STOCK':isLow?'LOW_STOCK':'IN_STOCK'}/></td>
      <td className="erp-table-cell erp-table-actions"><div className="allocation-list-row-actions"><button type="button" className="erp-table-icon-action" title="Print Inventory" aria-label="Print Inventory" onClick={event=>printDirectoryRow(event,'Inventory')}><Printer size={13}/></button></div></td>
    </tr>
   );
  })}</tbody>
 </table>;
}
