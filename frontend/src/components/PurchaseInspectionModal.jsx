import React,{useState} from 'react';
import { Search, Printer, X, FileCheck, ArrowLeftRight, RotateCcw, ClipboardList, UserRound, Calendar, MessageSquare, Warehouse, Boxes } from 'lucide-react';
import { printA4Report } from '../utils/printReport';
import './PurchaseInspectionModal.css';
import StatusBadge from './StatusBadge';

export default function PurchaseInspectionModal({ type, number, status, rows = [], columns, actions = [], headerActions = [], detailActions = [], onPrint, onClose, actionsPosition = 'bottom', details = [], detailsPosition = 'header', showHeaderClose = true, closeLabel = 'Close', tableToolbar = false, content, headerPrint = false, footer }) {
  const [tableQuery,setTableQuery]=useState('');
  const query=tableQuery.trim().toLowerCase();
  const visibleRows=tableToolbar && query ? rows.filter(row=>columns.some(column=>String(column.value(row) ?? '').toLowerCase().includes(query))) : rows;
  const unifiedDetails=detailsPosition === 'header' || detailsPosition === 'sidebar';
  const cardActions=unifiedDetails ? [...detailActions,...headerActions,...actions] : detailActions;
  const managementActions=unifiedDetails ? [] : headerActions;
  const footerActions=unifiedDetails ? [] : actions;
  const DocumentIcon = { GRN: FileCheck, GTN: ArrowLeftRight, PRN: RotateCcw, PO: ClipboardList, Inventory: Boxes }[type] || FileCheck;
  const documentTitle = { GRN: 'Goods received note', GTN: 'Goods transfer note', PRN: 'Purchase return note', PO: 'Purchase order', Inventory: 'Inventory stock' }[type] || type;
  const printDocument = () => {
    if (onPrint) { onPrint(); return; }
    const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
    printA4Report({
      title: `${type} ${escapeText(number)}`,
      metaItems: [{ label: 'Status', value: escapeText(status) }, ...details.map(detail => ({ label: detail.label, value: escapeText(detail.value || '—') }))],
      columns: columns.map((column, index) => ({ header: column.label, accessor: String(index), align: column.numeric ? 'right' : 'left' })),
      data: rows.map((row) => Object.fromEntries(columns.map((column, index) => [String(index), escapeText(column.value(row))]))),
    });
  };
  const detailsList = details.length > 0 && <dl className="purchase-inspection-details" aria-label={`${type} details`} style={{'--purchase-detail-columns':Math.max(1,Math.ceil(details.length/2))}}>
    {details.map(({ label, value, wide, icon }) => {
      const Icon = icon || (/supplier|staff/i.test(label) ? UserRound : /date/i.test(label) ? Calendar : /remarks/i.test(label) ? MessageSquare : Warehouse);
      return <div key={label} className={wide ? 'purchase-inspection-detail-wide' : undefined}><dt><Icon size={13} strokeWidth={1.7} />{label}</dt><dd>{value || '—'}</dd></div>;
    })}
  </dl>;
  const detailsSection = unifiedDetails || cardActions.length > 0 ? <div className="purchase-inspection-details-card">
    {detailsList}
    {cardActions.length > 0 && <div className="purchase-inspection-detail-actions" aria-label={`${type} details actions`}>
      {cardActions.map(({label,icon:Icon,onClick,disabled,tone})=><button key={label} type="button" className={`btn btn-glass${tone === 'danger' ? ' purchase-inspection-danger' : tone === 'success' ? ' purchase-inspection-success' : ''}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={15}/>} {label}</button>)}
    </div>}
  </div> : detailsList;
  const managementSection = managementActions.length > 0 && <div className="purchase-inspection-header-actions" aria-label={`${type} management actions`}>
{managementActions.map(({label,icon:Icon,onClick,disabled,tone})=><button key={label} type="button" className={`btn btn-glass${tone === 'danger' ? ' purchase-inspection-danger' : tone === 'success' ? ' purchase-inspection-success' : ''}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={15}/>} {label}</button>)}
          </div>;
  return (
    <div className="modal-backdrop" style={{ padding: '12px', zIndex: 1100 }}>
      <div className={`glass-modal purchase-inspection ${type.toLowerCase()}-inspection${tableToolbar ? ' purchase-inspection-toolbar-layout' : ''}${detailsPosition === 'sidebar' ? ' purchase-inspection-split' : ''}${actionsPosition === 'bottom' ? ' purchase-inspection-bottom-actions' : ''}`} role="dialog" aria-modal="true" aria-label={`${type} ${number}`}>
        <header className={`purchase-inspection-header${unifiedDetails ? ' purchase-inspection-header-details' : ''}`}>
          <div className="purchase-inspection-header-main">
            <div className="purchase-inspection-title"><div className="grn-inspection-symbol"><DocumentIcon size={22} strokeWidth={1.7} /></div><div><span className="purchase-inspection-caption">{documentTitle}</span><div className="purchase-inspection-number-row"><h2>{number}</h2>{unifiedDetails && <StatusBadge status={status}/>}</div></div></div>
            <div className="purchase-inspection-header-controls">{!unifiedDetails && <StatusBadge status={status}/>}
              {headerPrint && <button type="button" className="purchase-inspection-table-print" aria-label={`Print ${type}`} onClick={printDocument}><Printer size={15}/> Print</button>}
              {showHeaderClose && <button type="button" className="purchase-inspection-close" aria-label={`Close ${type} details`} title="Close" onClick={onClose}><X size={18}/></button>}
            </div>
          </div>
          {detailsPosition === 'header' && detailsSection}
          {detailsPosition !== 'sidebar' && managementSection}
        </header>
        {detailsPosition === 'below-header' && detailsSection}
        <div className="purchase-inspection-body">
          {detailsPosition === 'sidebar' && <aside className="purchase-inspection-sidebar" aria-label={`${type} information`}>{detailsSection}{managementSection}</aside>}
          <section className="purchase-inspection-items" aria-label={`${type} products`}>
            {tableToolbar && !content && <div className="purchase-inspection-table-toolbar" aria-label={`${type} table controls`}>
              <div className="purchase-inspection-table-search"><Search size={16}/><input type="search" aria-label={`Search ${type} products`} placeholder="Search product code or name..." value={tableQuery} onChange={event=>setTableQuery(event.target.value)}/>{tableQuery && <button type="button" aria-label="Clear table search" onClick={()=>setTableQuery('')}><X size={14}/></button>}</div>
              <button type="button" className="purchase-inspection-table-print" title={`Print ${type}`} aria-label={`Print ${type}`} onClick={printDocument}><Printer size={15}/> Print</button>
            </div>}

            {content || <div className="purchase-inspection-table"><table className="glass-table">
              <thead><tr>{columns.map((column) => <th key={column.label} className={column.numeric ? 'purchase-inspection-number' : ''}>{column.label}</th>)}</tr></thead>
              <tbody>{visibleRows.map((row, index) => <tr key={row.id ?? index}>{columns.map((column) => <td key={column.label} className={column.numeric ? 'purchase-inspection-number' : ''}>{column.value(row) ?? '—'}</td>)}</tr>)}
                {!visibleRows.length && <tr><td colSpan={columns.length} className="purchase-inspection-empty">{query ? 'No matching products found.' : 'No products found.'}</td></tr>}
              </tbody>
            </table></div>}
          </section>
          {!tableToolbar && <aside className="purchase-inspection-actions" aria-label={`${type} actions`}>
            <button type="button" className="btn btn-primary" title={`Print ${type}`} onClick={printDocument}><Printer size={15} /> Print</button>
            {footerActions.map(({ label, icon: Icon, onClick, disabled, tone }) => <button key={label} type="button" className="btn btn-glass" onClick={onClick} disabled={disabled} style={tone === 'danger' ? { color: '#e11d48' } : undefined}>{Icon && <Icon size={15} />}{label}</button>)}
            <button type="button" className="btn btn-glass" aria-label={`Close ${type} ${showHeaderClose ? 'popup' : 'details'}`} onClick={onClose}>{!closeLabel && <X size={15}/>} {closeLabel || `Back to ${type === 'PO' ? 'POs' : `${type}s`}`}</button>
          </aside>}
        </div>
        {footer}
      </div>
    </div>
  );
}
