import React from 'react';
import { Printer, X, FileCheck, ArrowLeftRight, RotateCcw, ClipboardList, UserRound, Calendar, MessageSquare, Warehouse } from 'lucide-react';
import { printA4Report } from '../utils/printReport';
import './PurchaseInspectionModal.css';

export default function PurchaseInspectionModal({ type, number, status, rows = [], columns, actions = [], onPrint, onClose, actionsPosition = 'bottom', details = [] }) {
  const DocumentIcon = { GRN: FileCheck, GTN: ArrowLeftRight, PRN: RotateCcw, PO: ClipboardList }[type] || FileCheck;
  const documentTitle = { GRN: 'Goods received note', GTN: 'Goods transfer note', PRN: 'Purchase return note', PO: 'Purchase order' }[type] || type;
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
  return (
    <div className="modal-backdrop" style={{ padding: '12px', zIndex: 1100 }}>
      <div className={`glass-modal purchase-inspection${type === 'GRN' ? ' grn-inspection' : ''}${actionsPosition === 'bottom' ? ' purchase-inspection-bottom-actions' : ''}`} role="dialog" aria-modal="true" aria-label={`${type} ${number}`}>
        <header className="purchase-inspection-header"><div className="purchase-inspection-title"><div className="grn-inspection-symbol"><DocumentIcon size={22} strokeWidth={1.7} /></div><div><span>{documentTitle}</span><h2>{number}</h2></div></div><strong className={`purchase-document-status status-${status?.toLowerCase()}`}>{status}</strong></header>
        {details.length > 0 && <dl className="purchase-inspection-details" aria-label={`${type} details`}>
          {details.map(({ label, value, wide, icon }) => {
            const Icon = icon || (/supplier/i.test(label) ? UserRound : /date/i.test(label) ? Calendar : /remarks/i.test(label) ? MessageSquare : Warehouse);
            return <div key={label} className={wide ? 'purchase-inspection-detail-wide' : undefined}><dt><Icon size={13} strokeWidth={1.7} />{label}</dt><dd>{value || '—'}</dd></div>;
          })}
        </dl>}
        <div className="purchase-inspection-body">
          <section className="purchase-inspection-items" aria-label={`${type} products`}>
            <div className="purchase-inspection-table"><table className="glass-table">
              <thead><tr>{columns.map((column) => <th key={column.label} className={column.numeric ? 'purchase-inspection-number' : ''}>{column.label}</th>)}</tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.id ?? index}>{columns.map((column) => <td key={column.label} className={column.numeric ? 'purchase-inspection-number' : ''}>{column.value(row) ?? '—'}</td>)}</tr>)}
                {!rows.length && <tr><td colSpan={columns.length} className="purchase-inspection-empty">No products found.</td></tr>}
              </tbody>
            </table></div>
          </section>
          <aside className="purchase-inspection-actions" aria-label={`${type} actions`}>
            <button type="button" className="btn btn-primary" title={`Print ${type}`} onClick={printDocument}><Printer size={15} /> Print</button>
            {actions.map(({ label, icon: Icon, onClick, disabled, tone }) => <button key={label} type="button" className="btn btn-glass" onClick={onClick} disabled={disabled} style={tone === 'danger' ? { color: '#e11d48' } : undefined}>{Icon && <Icon size={15} />}{label}</button>)}
            <button type="button" className="btn btn-glass" aria-label={`Close ${type} details`} onClick={onClose}><X size={15} /> Back to {type === 'PO' ? 'POs' : `${type}s`}</button>
          </aside>
        </div>
      </div>
    </div>
  );
}
