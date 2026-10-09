/**
 * Reusable A4 Enterprise Report Printing & PDF Utility
 * Standard structure for all ERP pages (Customers, Sales, Inventory, Purchasing, etc.)
 */

export function printA4Report({
  title = 'ERP System Report',
  subtitle = '',
  metaItems = [], // Array of { label: string, value: string }
  columns = [], // Array of { header: string, accessor: string | function, align?: 'left'|'center'|'right', width?: string }
  data = [], // Array of row objects
  summaryItems = [], // Array of { label: string, value: string }
  footerNote = 'NBH Enterprise Resource Planning • Confidential Business Record',
}) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow popups to print / export this document.');
    return;
  }

  const currentDate = new Date().toLocaleString();

  const metaHtml = metaItems.length > 0
    ? `<div class="meta-grid">
        ${metaItems.map((m) => `
          <div class="meta-item">
            <span class="meta-label">${m.label}:</span>
            <span class="meta-value">${m.value || '—'}</span>
          </div>
        `).join('')}
      </div>`
    : '';

  const tableHeaderHtml = `
    <thead>
      <tr>
        ${columns.map((col) => `
          <th style="text-align: ${col.align || 'left'}; width: ${col.width || 'auto'};">
            ${col.header}
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const tableRowsHtml = data.length > 0
    ? data.map((row, idx) => `
        <tr class="${idx % 2 === 1 ? 'even-row' : ''}">
          ${columns.map((col) => {
            let val = typeof col.accessor === 'function' ? col.accessor(row, idx) : row[col.accessor];
            if (val === undefined || val === null || val === '') val = '—';
            return `<td style="text-align: ${col.align || 'left'};">${val}</td>`;
          }).join('')}
        </tr>
      `).join('')
    : `<tr><td colspan="${columns.length}" style="text-align: center; padding: 24px; color: #64748b;">No records found</td></tr>`;

  const summaryHtml = summaryItems.length > 0
    ? `<div class="summary-container">
        ${summaryItems.map((s) => `
          <div class="summary-box">
            <span class="summary-label">${s.label}</span>
            <span class="summary-val">${s.value}</span>
          </div>
        `).join('')}
      </div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 14mm 14mm 14mm;
        }
        @page landscape {
          size: A4 landscape;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #0f172a;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .company-name {
          font-size: 17px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: -0.02em;
        }
        .company-subtitle {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 2px;
        }
        .doc-title-block {
          text-align: right;
        }
        .doc-title {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          text-transform: uppercase;
        }
        .doc-sub {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 2px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 6px 16px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .meta-item {
          display: flex;
          gap: 6px;
          font-size: 10.5px;
        }
        .meta-label {
          font-weight: 700;
          color: #475569;
        }
        .meta-value {
          color: #0f172a;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }
        th {
          background-color: #0284c7;
          color: #ffffff;
          font-weight: 700;
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 6px 8px;
          border: 1px solid #0284c7;
        }
        td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          font-size: 10px;
        }
        .even-row {
          background-color: #f8fafc;
        }
        .summary-container {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 10px;
          margin-bottom: 16px;
        }
        .summary-box {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 6px 12px;
          text-align: right;
        }
        .summary-label {
          display: block;
          font-size: 9px;
          color: #166534;
          font-weight: 700;
          text-transform: uppercase;
        }
        .summary-val {
          font-size: 12px;
          color: #15803d;
          font-weight: 800;
        }
        .report-footer {
          margin-top: 24px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div>
          <div class="company-name">NBH ENTERPRISE</div>
          <div class="company-subtitle">Inventory, Wholesale & Commercial Distribution ERP</div>
        </div>
        <div class="doc-title-block">
          <h1 class="doc-title">${title}</h1>
          ${subtitle ? `<div class="doc-sub">${subtitle}</div>` : ''}
          <div class="doc-sub">Generated: ${currentDate}</div>
        </div>
      </div>

      ${metaHtml}

      <table>
        ${tableHeaderHtml}
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      ${summaryHtml}

      <div class="report-footer">
        <span>${footerNote}</span>
        <span>A4 Format • Page 1 of 1</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export {
  printCustomerStatementA4,
  printCustomerGroupRosterA4,
  printCustomerDirectoryA4,
  printCustomerLedgerA4,
  executeA4Print,
} from './customerPrintTemplates';

export default printA4Report;
