import React from 'react';
import { Download, Printer, RefreshCw, Eye, Edit2, History } from 'lucide-react';

/**
 * Reusable Global Toolbar Action Buttons (Export CSV, Print A4, Download PDF, Refresh)
 * Standardized across all ERP hubs (Employees, Customers, Groups, Inventory, Sales)
 */
export function ToolbarActions({
  onExportCsv,
  onPrint,
  onDownloadPdf,
  onRefresh,
  loading = false,
  exportTitle = 'Export to CSV',
  printTitle = 'Print Report (A4)',
  pdfTitle = 'Download PDF Report (A4)',
  refreshTitle = 'Refresh Records',
  extraActions = null,
}) {
  const buttonStyle = {
    height: '34px',
    width: '36px',
    minWidth: '36px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    color: '#334155',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
    transition: 'all 0.15s ease',
    padding: 0,
    outline: 'none',
  };

  const handleMouseEnter = (e) => {
    e.currentTarget.style.backgroundColor = '#f8fafc';
    e.currentTarget.style.borderColor = '#94a3b8';
    e.currentTarget.style.color = '#0f172a';
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.backgroundColor = '#ffffff';
    e.currentTarget.style.borderColor = '#e2e8f0';
    e.currentTarget.style.color = '#334155';
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      {extraActions}

      {onExportCsv && (
        <button
          type="button"
          onClick={onExportCsv}
          disabled={loading}
          style={buttonStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title={exportTitle}
        >
          <Download size={14} />
        </button>
      )}

      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          disabled={loading}
          style={buttonStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title={printTitle}
        >
          <Printer size={14} />
        </button>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={buttonStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title={refreshTitle}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}

/**
 * Reusable Global Table Row Action Buttons (Print, Download PDF, View, History, Edit)
 */
export function TableRowActions({
  onPrint,
  onDownloadPdf,
  onView,
  onHistory,
  onEdit,
  printTitle = 'Print Document (A4)',
  pdfTitle = 'Download PDF (A4)',
  viewTitle = 'View Details',
  historyTitle = 'View History & Ledger',
  editTitle = 'Edit Record',
  extraActions = null,
}) {
  const actions = [
    [onPrint, printTitle, Printer],
    [onView, viewTitle, Eye],
    [onDownloadPdf, pdfTitle, Download],
    [onHistory, historyTitle, History],
    [onEdit, editTitle, Edit2],
  ];
  return <div className="erp-row-actions" onClick={event=>event.stopPropagation()}>
    {extraActions}
    {actions.filter(([handler])=>handler).map(([handler,title,Icon])=>(
      <button key={title} type="button" className="erp-table-icon-action"
        title={title} aria-label={title} onClick={event=>{event.stopPropagation();handler();}}>
        <Icon size={13}/>
      </button>
    ))}
  </div>;
}

export default ToolbarActions;
