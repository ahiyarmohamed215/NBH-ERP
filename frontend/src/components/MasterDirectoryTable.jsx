import React from 'react';
import {Edit2,Printer,Trash2} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {recordStatus} from '../utils/masterRecordLifecycle';
import {printDirectoryRow} from '../utils/printDirectory';
const kinds={products:'Product',brands:'Brand',warehouses:'Warehouse',categories:'Category'};
export default function MasterDirectoryTable({type,rows,warehouses=[],getBrand,canEdit,onView,onEdit,onDelete,isActive}) {
 const name=kinds[type];
 const code={label:type==='products'?'Code / SKU':`${name} code`,render:row=><strong className="allocation-list-code">{row.sku || row.code || '—'}</strong>};
 const title={label:`${name} name`,render:row=><strong className="allocation-list-name">{row.name || '—'}</strong>};
 const remarks={label:'Remarks',render:row=>row.remarks || row.description || row.notes || '—'};
 const status={label:'Status',render:row=><StatusBadge status={recordStatus(row)}/>};
 const product={label:'Code / Product name',render:row=><><strong className="allocation-list-code">{row.sku || row.code || '—'}</strong>{' '}<span className="allocation-list-name">{row.name || '—'}</span></>};
 const brandCategory={label:'Brand / Category',render:row=><><strong className="allocation-list-name">{getBrand(row) || '—'}</strong>{' '}<span className="allocation-list-secondary">{row.categoryName || '—'}</span></>};
 const warehouse={label:'Warehouse',render:row=>row.warehouseName || row.defaultWarehouseName || warehouses.find(w=>String(w.id)===String(row.warehouseId || row.defaultWarehouseId))?.name || '—'};
 const columns=type==='products'?[product,brandCategory,warehouse,{label:'Min stock',render:row=>row.minStockLevel ?? 0},status,remarks]
  :type==='brands'?[code,title,{label:'MP%',render:row=>`${Number(row.markupPercent || 0).toFixed(2)}%`},status,remarks]
  :type==='warehouses'?[code,title,{label:'Address',render:row=>row.address || '—'},{label:'Contact number',render:row=>row.contactNumber || row.phone || '—'},status,remarks]
  :[code,title,status,remarks];
 return <table className={(`master-directory-table master-directory-${type}`) + ' erp-table'} aria-label={`${name} directory`}><thead><tr>{columns.map(column=><th className="erp-table-heading" key={column.label}>{column.label}</th>)}<th className="allocation-list-actions erp-table-heading erp-table-actions">Actions</th></tr></thead><tbody>{!rows.length?<tr><td colSpan={columns.length+1} className="master-directory-empty erp-table-cell">No {type} found matching current criteria.</td></tr>:rows.map(row=><tr key={row.id} onClick={()=>onView(row)} title={`Click row to view ${name.toLowerCase()} details`}>{columns.map(column=><td className="erp-table-cell" key={column.label}>{column.render(row)}</td>)}<td className="allocation-list-actions erp-table-cell erp-table-actions"><div className="allocation-list-row-actions">{canEdit && <button className="erp-table-icon-action" type="button" title={`Edit ${name}`} aria-label={`Edit ${name}`} onClick={event=>{event.stopPropagation();onEdit(row);}}><Edit2 size={13}/></button>}<button className="erp-table-icon-action" type="button" title={`Print ${name}`} aria-label={`Print ${name}`} onClick={event=>printDirectoryRow(event,name)}><Printer size={13}/></button>{canEdit && onDelete && <button type="button" className="erp-table-icon-action" data-tone="danger" aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={event=>{event.stopPropagation();onDelete(row);}}><Trash2 size={13}/></button>}</div></td></tr>)}</tbody></table>;
}
