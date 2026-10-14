import React from 'react';
import {Edit2,Printer,ShieldCheck} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {staffCode} from '../utils/staffCode';
import {printCurrentDirectory} from '../utils/printDirectory';

export default function AllocationTable({rows,loading,canEdit,onView,onEdit,statusOf,onCreate}) {
  const printRow=event=>{
    event.stopPropagation();
    const row=event.currentTarget.closest('tr'),table=row.closest('table').cloneNode(true);
    table.querySelector('tbody').replaceChildren(row.cloneNode(true));
    const root=document.createElement('div');root.append(table);
    printCurrentDirectory(root,'Inventory Allocation');
  };
  return <div className="allocation-list-table erp-table-frame"><div className="allocation-list-scroll erp-table-scroll"><table className="erp-table" aria-label="Inventory allocations">
    <thead><tr>{['Product','Staff member','Total stock available','Given to staff','Status','Actions'].map(label=><th key={label} className={(label==='Actions'?'allocation-list-actions':undefined) + ' erp-table-heading'}>{label}</th>)}</tr></thead>
    <tbody>{loading?<tr><td colSpan={6} className="allocation-list-empty erp-table-cell">Loading inventory allocations...</td></tr>:!rows.length?<tr><td colSpan={6} className="allocation-list-empty erp-table-cell"><ShieldCheck size={28}/><p>No inventory allocations found.</p>{canEdit && <button type="button" className="btn btn-primary erp-button" onClick={onCreate}>New Allocation</button>}</td></tr>:rows.map(q=>{
      const stock=Number(q.totalStockAvailable ?? q.currentStockInWarehouse ?? 0),unit=q.productUnit || 'Units';
      return <tr key={q.id} onClick={()=>onView(q)} title="Click row to view allocation details">
        <td className="erp-table-cell"><strong className="allocation-list-code">{q.productSku || '—'}</strong><span className="allocation-list-name">{q.productName || 'Product not selected'}</span></td>
        <td className="erp-table-cell"><strong className="allocation-list-name">{q.userFullName || q.username || 'Staff not selected'}</strong><span className="allocation-list-secondary">{q.userEmployeeCode || (q.userId?staffCode({id:q.userId}):'—')}</span></td>
        <td className="allocation-list-quantity erp-table-cell"><span className={q.productId && stock<=0?'allocation-list-stock-empty':undefined}>{q.productId?stock.toLocaleString():'—'}</span>{q.productId && <small> {unit}</small>}</td>
        <td className="allocation-list-quantity erp-table-cell">{q.allocatedQuantity==null?'—':Number(q.allocatedQuantity).toLocaleString()}{q.allocatedQuantity!=null && <small> {unit}</small>}</td>
        <td className="erp-table-cell" onClick={event=>event.stopPropagation()}><StatusBadge status={statusOf(q)}/></td>
        <td className="allocation-list-actions erp-table-cell erp-table-actions"><div className="allocation-list-row-actions">{canEdit && <button className="erp-table-icon-action" type="button" title="Edit Allocation" aria-label="Edit Allocation" onClick={event=>{event.stopPropagation();onEdit(q);}}><Edit2 size={13}/></button>}<button className="erp-table-icon-action" type="button" title="Print Allocation" aria-label="Print Allocation" onClick={printRow}><Printer size={13}/></button></div></td>
      </tr>;
    })}</tbody>
  </table></div></div>;
}
