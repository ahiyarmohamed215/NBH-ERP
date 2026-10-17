import React from 'react';
import {Edit2,Printer,ShieldCheck,Trash2} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {staffCode} from '../utils/staffCode';
import {printCurrentDirectory} from '../utils/printDirectory';

export function allocationCode(quota) {
  return quota?.allocationCode || quota?.code || (quota?.id != null ? `ALC-${String(quota.id).padStart(4,'0')}` : '—');
}

export function groupQuotas(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  const result = [];
  for (const q of list) {
    if (q.items && q.items.length > 0) {
      result.push(q);
      continue;
    }
    const timeKey = q.createdAt ? q.createdAt.slice(0, 16) : `id_${q.id}`;
    const key = `${q.userId ?? q.username ?? 'none'}_${timeKey}_${q.notes || ''}_${q.status || ''}`;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.items.push(q);
      existing.totalProducts = existing.items.length;
    } else {
      const grouped = {
        ...q,
        items: [q],
        totalProducts: 1,
      };
      map.set(key, grouped);
      result.push(grouped);
    }
  }
  return result;
}

export default function AllocationTable({rows,loading,canEdit,onView,onEdit,onDelete,statusOf,onCreate}) {
  const printRow=event=>{
    event.stopPropagation();
    const row=event.currentTarget.closest('tr'),table=row.closest('table').cloneNode(true);
    table.querySelector('tbody').replaceChildren(row.cloneNode(true));
    const root=document.createElement('div');root.append(table);
    printCurrentDirectory(root,'Inventory Allocation');
  };

  const displayRows = groupQuotas(rows);

  return <div className="allocation-list-table erp-table-frame"><div className="allocation-list-scroll erp-table-scroll"><table className="erp-table" aria-label="Inventory allocations">
    <thead><tr>{['Allocation code','Staff member','Total products','Date','Status','Remarks','Actions'].map(label=><th key={label} className={(label==='Actions'?'allocation-list-actions':undefined) + ' erp-table-heading'} style={{textAlign:label==='Actions'?'right':label==='Total products'?'center':'left'}}>{label}</th>)}</tr></thead>
    <tbody>{loading?<tr><td colSpan={7} className="allocation-list-empty erp-table-cell">Loading inventory allocations...</td></tr>:!displayRows.length?<tr><td colSpan={7} className="allocation-list-empty erp-table-cell"><ShieldCheck size={28}/><p>No inventory allocations found.</p>{canEdit && <button type="button" className="btn btn-primary erp-button" onClick={onCreate}>New Allocation</button>}</td></tr>:displayRows.map(q=>{
      return <tr key={q.id} onClick={()=>onView(q)} title="Click row to view allocation details" style={{cursor:'pointer'}}>
        <td className="erp-table-cell"><span className="erp-table-code">{allocationCode(q)}</span></td>
        <td className="erp-table-cell">
          <strong className="allocation-list-name">{q.userFullName || q.username || 'Staff not selected'}</strong>
          <span className="allocation-list-secondary">{q.userEmployeeCode || (q.userId?staffCode({id:q.userId}):'—')}</span>
        </td>
        <td className="erp-table-cell" style={{textAlign:'center'}}>
          <span className="allocation-total-products" style={{fontWeight:600}}>{q.items?.length || q.totalProducts || 1}</span>
        </td>
        <td className="erp-table-cell erp-table-date">{q.createdAt?.slice(0,10) || '—'}</td>
        <td className="erp-table-cell"><StatusBadge status={statusOf(q)}/></td>
        <td className="erp-table-cell" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={q.notes || q.remarks || ''}>{q.notes || q.remarks || '—'}</td>
        <td className="allocation-list-actions erp-table-cell erp-table-actions"><div className="allocation-list-row-actions">{canEdit && <button className="erp-table-icon-action" type="button" title="Edit Allocation" aria-label="Edit Allocation" onClick={event=>{event.stopPropagation();onEdit(q);}}><Edit2 size={13}/></button>}<button className="erp-table-icon-action" type="button" title="Print Allocation" aria-label="Print Allocation" onClick={printRow}><Printer size={13}/></button>{canEdit && onDelete && <button className="erp-table-icon-action" data-tone="danger" type="button" title="Delete Allocation" aria-label="Delete Allocation" onClick={event=>{event.stopPropagation();onDelete(q);}}><Trash2 size={13}/></button>}</div></td>
      </tr>;
    })}</tbody>
  </table></div></div>;
}
