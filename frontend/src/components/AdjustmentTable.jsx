import React from 'react';
import {Edit2, Printer} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {adjustmentStatus, adjustmentQuantity, printStockAdjustment} from '../utils/stockAdjustmentPresentation';

export default function AdjustmentTable({rows, canEdit, onView, onEdit}) {
  return <div className="erp-table-frame" style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
    <div className="erp-table-scroll" style={{overflow:'auto',flex:1,minHeight:0}}>
      <table className="erp-table" aria-label="Stock adjustments" style={{width:'100%',minWidth:1040,borderCollapse:'collapse',textAlign:'left'}}>
        <thead><tr>{['Adjustment code','Type','Warehouse','Product code / Name','Qty adjusted','Date','Status','Reason','Actions'].map(label=><th key={label} className={`erp-table-heading${label==='Actions'?' erp-table-actions':''}`} style={{textAlign:label==='Actions'||label==='Qty adjusted'?'right':'left'}}>{label}</th>)}</tr></thead>
        <tbody>{!rows.length?<tr><td className="erp-table-cell" colSpan={9} style={{textAlign:'center',color:'#64748b'}}>No adjustment records found matching selected filters.</td></tr>:rows.map(record=><tr key={record.id} onClick={()=>onView(record)} title="Click row to view adjustment details">
          <td className="erp-table-cell"><span className="erp-table-code">{record.recordNo}</span></td>
          <td className="erp-table-cell">{record.type}</td>
          <td className="erp-table-cell">{record.warehouse || '—'}</td>
          <td className="erp-table-cell"><span className="erp-table-code">{record.sku || '—'}</span><div style={{marginTop:4,fontWeight:600}}>{record.productName || '—'}</div></td>
          <td className="erp-table-cell" style={{textAlign:'right'}}>{adjustmentQuantity(record)}</td>
          <td className="erp-table-cell erp-table-date" style={{whiteSpace:'nowrap',minWidth:100}}>{record.date || '—'}</td>
          <td className="erp-table-cell"><StatusBadge status={adjustmentStatus(record)}/></td>
          <td className="erp-table-cell" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={record.reason || ''}>{record.reason || '—'}</td>
          <td className="erp-table-cell erp-table-actions" style={{textAlign:'right'}}><div style={{display:'inline-flex',gap:6,alignItems:'center',justifyContent:'flex-end'}}>
            {canEdit && adjustmentStatus(record)!=='CANCELLED' && <button className="erp-table-icon-action" type="button" title="Edit Adjustment" aria-label="Edit Adjustment" onClick={event=>{event.stopPropagation();onEdit(record);}}><Edit2 size={13}/></button>}
            <button className="erp-table-icon-action" type="button" title="Print Adjustment" aria-label="Print Adjustment" onClick={event=>{event.stopPropagation();printStockAdjustment(record);}}><Printer size={13}/></button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
