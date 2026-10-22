import React from 'react';
import {Edit2, Printer, RotateCcw} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {adjustmentStatus, adjustmentQuantity, printStockAdjustment} from '../utils/stockAdjustmentPresentation';

export default function AdjustmentTable({rows, loading = false, canEdit, onView, onEdit, onCancel}) {
  return <div className="erp-table-frame" style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
    <div className="erp-table-scroll" style={{overflowY:'auto',overflowX:'auto',flex:1,minHeight:0,width:'100%'}}>
      <table className="erp-table adjustment-table" aria-label="Stock adjustments" style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
        <thead><tr>{['Adjustment code','Type','Total products','Date','Status','Adjusted through','Reason','Actions'].map(label=><th key={label} className={`erp-table-heading${label==='Actions'?' erp-table-actions':''}`} style={{textAlign:label==='Actions'?'right':label==='Total products'?'center':'left',whiteSpace:label==='Reason'?'normal':'nowrap'}}>{label}</th>)}</tr></thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="erp-table-cell" colSpan={8} style={{textAlign:'center',padding:'40px',color:'#64748b'}}>
                Loading stock adjustment data...
              </td>
            </tr>
          ) : !rows.length ? (
            <tr>
              <td className="erp-table-cell" colSpan={8} style={{textAlign:'center',padding:'32px',color:'#64748b'}}>
                No adjustment records found matching selected filters.
              </td>
            </tr>
          ) : (
            rows.map(record=><tr key={record.id} onClick={()=>onView(record)} title="Click row to view complete adjustment details" style={{cursor:'pointer'}}>
              <td className="erp-table-cell" style={{whiteSpace:'nowrap'}}><span className="erp-table-code">{record.recordNo}</span></td>
              <td className="erp-table-cell" style={{whiteSpace:'nowrap'}}>{record.type}</td>
              <td className="erp-table-cell" style={{textAlign:'center',whiteSpace:'nowrap'}}>
                <span className="adjustment-total-products" style={{fontWeight:600}}>{record.items?.length || record.totalProducts || 1}</span>
              </td>
              <td className="erp-table-cell erp-table-date" style={{whiteSpace:'nowrap'}}>{record.date || '—'}</td>
              <td className="erp-table-cell" style={{whiteSpace:'nowrap'}}><StatusBadge status={adjustmentStatus(record)}/></td>
              <td className="erp-table-cell" style={{whiteSpace:'nowrap'}}>{record.sourceHeldBillNumber?<><strong>Onhold Bill</strong><div className="erp-table-code">{record.sourceHeldBillNumber}</div></>:'Manual adjustment'}</td>
              <td className="erp-table-cell" style={{maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={record.reason || ''}>{record.reason || '—'}</td>
              <td className="erp-table-cell erp-table-actions" style={{textAlign:'right',whiteSpace:'nowrap'}}><div style={{display:'inline-flex',gap:6,alignItems:'center',justifyContent:'flex-end'}}>
                {canEdit && !record.sourceHeldBillId && adjustmentStatus(record) === 'DRAFT' && (
                  <>
                    <button className="erp-table-icon-action" type="button" title="Edit Adjustment" aria-label="Edit Adjustment" onClick={event=>{event.stopPropagation();onEdit(record);}}><Edit2 size={13}/></button>
                    {onCancel && <button className="erp-table-icon-action" type="button" title="Cancel Adjustment" aria-label="Cancel Adjustment" style={{color:'#e11d48'}} onClick={event=>{event.stopPropagation();onCancel(record);}}><RotateCcw size={13}/></button>}
                  </>
                )}
                <button className="erp-table-icon-action" type="button" title="Print Adjustment" aria-label="Print Adjustment" onClick={event=>{event.stopPropagation();printStockAdjustment(record);}}><Printer size={13}/></button>
              </div></td>
            </tr>)
          )}
        </tbody>
      </table>
    </div>
  </div>;
}
