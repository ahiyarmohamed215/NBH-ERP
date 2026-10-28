import {packingFields} from './invoicePacking.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const warehousePrintName = bill => `Onhold Bill WH Review Copy-${new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Colombo'})}${bill?.heldNumber ? `-${bill.heldNumber}` : ''}`;

function warehouseTimestamp(value) {
  if (!value) return '—';
  const raw = String(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  // Server LocalDateTime values are Sri Lanka time; offsets on UTC timestamps are preserved.
  const local = !dateOnly && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(dateOnly ? `${raw}T00:00:00+05:30` : local ? `${raw}+05:30` : raw);
  if (Number.isNaN(date.getTime())) return '—';
  const options = {timeZone:'Asia/Colombo', day:'2-digit', month:'short', year:'numeric',
    ...(!dateOnly ? {hour:'2-digit', minute:'2-digit', hourCycle:'h12'} : {})};
  return new Intl.DateTimeFormat('en-GB', options).formatToParts(date)
    .map(part => part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value).join('');
}

export function warehouseGroups(bill) {
  const groups = new Map();
  for (const item of bill.items || []) {
    const id = String(item.warehouseId || bill.warehouseId);
    if (!groups.has(id)) groups.set(id, { id, name: item.warehouseName || bill.warehouseName, items: [] });
    groups.get(id).items.push(item);
  }
  return [...groups.values()];
}

export function heldWarehouseHtml(bill, warehouse = '') {
  const groups = warehouseGroups(bill).filter(g => !warehouse || g.id === String(warehouse));
  const rawRemarks = bill.posRemarks ?? String(bill.notes || '').split('\nWarehouse review:')[0];
  const remarks = rawRemarks?.trim();
  const printDate = warehouseTimestamp(new Date().toISOString());
  const savedAt = warehouseTimestamp(bill.heldSavedAt || bill.createdAt || bill.invoiceDate);
  const status = String(bill.status || 'POS_ONHOLD').toUpperCase();
  const statusTone = ['CANCELLED', 'CANCELED', 'INVOICE_CANCELLED', 'VOIDED'].includes(status) ? 'cancelled'
    : ['STOCK_ADJUSTED', 'INVOICE_CREATED', 'BILLED'].includes(status) ? 'success'
    : ['POS_ONHOLD', 'YET_TO_PRINT', 'SENT_TO_WAREHOUSE', 'HELD', 'HELD_AT_POS'].includes(status) ? 'pending' : 'neutral';
  const docStatus = ({
    STOCK_ADJUSTED: 'Warehouse reviewed',
    POS_ONHOLD: 'Sent to warehouse',
    YET_TO_PRINT: 'Sent to warehouse',
    SENT_TO_WAREHOUSE: 'Sent to warehouse',
    HELD: 'Sent to warehouse',
    HELD_AT_POS: 'Sent to warehouse'
  })[status] || (['CANCELLED', 'CANCELED', 'INVOICE_CANCELLED', 'VOIDED'].includes(status) ? 'Cancelled' : status.replaceAll('_', ' ').toLowerCase());

  const customerName = bill.customerName || bill.customer?.name || 'Walk-in Customer';
  const customerCode = bill.customerCode || bill.customer?.customerCode || bill.customer?.code || '—';
  const customerAddress = bill.customerAddress || bill.customer?.address || bill.address || '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(warehousePrintName(bill))}</title><style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;font:11px/1.35 "Segoe UI",Arial,sans-serif;color:#1e293b;background:#fff}
section{width:210mm;height:296.5mm;max-height:296.5mm;box-sizing:border-box;padding:8mm 12mm 8mm 12mm;margin:0 auto;display:flex;flex-direction:column;justify-content:space-between;background:#fff;position:relative;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
section+section{break-before:page;page-break-before:always}
.sheet-main{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.sheet-bottom{margin-top:auto;flex-shrink:0}
.document-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:0 0 6px;border-bottom:2px solid #0284c7;margin-bottom:6px}
.brand-block{display:flex;align-items:center;gap:12px;min-width:0}
.brand-logo-badge{width:36px;height:36px;flex-shrink:0;background:#0284c7;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.brand{font-size:18px;line-height:1.2;font-weight:700;letter-spacing:.02em;color:#0f172a}
.brand-sub{font-size:9.5px;color:#475569;margin-top:2px}
.warehouse-highlight-badge{display:inline-flex;align-items:center;background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:4px;margin-top:4px;border:1px solid #fca5a5}
.wh-highlight-title{font-size:11.5px;font-weight:700;letter-spacing:.02em;color:#b91c1c}
.document-title{text-align:right;max-width:48%}
h1{font-size:24px;line-height:1.15;margin:0 0 3px;font-weight:700;letter-spacing:-.03em;color:#0369a1}
.document-number{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.doc-badge-row{margin-top:3px}
.status-badge{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.04em;border:1px solid transparent}
.status-badge-pending{background:#fef3c7;color:#854d0e;border-color:#fde68a}
.status-badge-success{background:#dcfce7;color:#15803d;border-color:#bbf7d0}
.status-badge-cancelled{background:#fff1f2;color:#be123c;border-color:#fecdd3}
.status-badge-neutral{background:#f1f5f9;color:#475569;border-color:#e2e8f0}
.status-dot{width:5px;height:5px;border-radius:50%;background:currentColor}
.upper-grid{display:grid;grid-template-columns:minmax(0,1fr) calc(1in + 64px);gap:10px;margin-bottom:4px;align-items:stretch}
.upper-left{display:flex;flex-direction:column;gap:6px;min-width:0}
.document-meta{display:grid;grid-template-columns:1.2fr 1fr;gap:8px 14px;padding:6px 9px;background:#f8fafc;border:1px solid #e2e8f0}
.meta-card{min-width:0}
.customer-identity{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:baseline;gap:12px}
.customer-identity .meta-sub{margin-top:0;font-size:11px;font-weight:700;color:#475569}
.meta-staff .meta-value{font-size:11.5px;line-height:1.3;font-weight:600}
.meta-staff{display:flex;flex-direction:column;gap:6px;min-width:0;border-left:1px solid #e2e8f0;padding-left:14px}
.meta-customer .meta-value{font-size:13.5px;font-weight:700;color:#0f172a}
.meta-label{display:block;font-size:9.5px;font-weight:700;color:#475569;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
.meta-value{font-size:11.5px;line-height:1.35;font-weight:600;overflow-wrap:anywhere}
.meta-address-val{font-size:11.5px;line-height:1.4;font-weight:400;color:#334155;overflow-wrap:anywhere;margin-top:5px}
.meta-sub{font-size:10px;color:#475569;margin-top:4px;line-height:1.3}
.meta-sub strong{color:#0f172a;font-weight:600}
.remarks{flex:1;min-height:34px;border:1px solid #dbeafe;background:#f0f9ff;padding:5px 9px;white-space:pre-wrap;font-size:11px;line-height:1.35;overflow-wrap:anywhere}
.remarks strong{display:block;margin-bottom:2px;color:#0369a1;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.instructions-card{padding:2px 0;margin:0 0 8px}
.instructions{font-size:10px;color:#334155;margin:0;line-height:1.35}
.packing-panel{width:100%;margin:0;break-inside:avoid}
.packing-title{font-size:11.5px;font-weight:700;color:#0f172a}
.packing-form{display:flex;flex-direction:column;gap:4px}
.packing-box{display:grid;grid-template-columns:56px 1in;align-items:center;gap:8px;height:5.5mm}
.packing-label{font-size:10.5px;font-weight:700;color:#475569}
.packing-val{width:1in;height:100%;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;font-variant-numeric:tabular-nums;color:#0369a1}
.packing-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px}
.packing-caption{font-size:9px;color:#475569}
table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:8px;border:1px solid #cbd5e1}
thead{display:table-header-group}
tr{break-inside:avoid}
.sheet-reference th{background:#f8fafc;color:#475569;padding:3px 8px;font-size:10px;font-weight:700;text-align:left;border-bottom:1px solid #cbd5e1;overflow-wrap:anywhere}
.sheet-reference span{float:right;color:#64748b;font-weight:500;margin-left:10px}
thead tr:last-child th{background:#0b3b6d;color:#ffffff;font-size:11px;font-weight:700;padding:4px 8px;border-bottom:1px solid #0b3b6d;text-align:left}
thead tr:last-child th:nth-child(1),thead tr:last-child th:nth-child(4),thead tr:last-child th:nth-child(5){text-align:center}
tbody tr{height:0.8cm;min-height:0.8cm;max-height:0.8cm}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{height:0.8cm;box-sizing:border-box;padding:0 8px;border:1px solid #e2e8f0;overflow-wrap:anywhere;vertical-align:middle}
tbody td:first-child{text-align:center;font-weight:700;color:#475569;font-size:12px;font-variant-numeric:tabular-nums;padding:0 2px}
tr.fill-row td{height:0.8cm;padding:0 8px;color:transparent}
tfoot tr{background:#f8fafc;font-weight:700;height:0.8cm}
tfoot td{height:0.8cm;padding:0 8px;border:1px solid #cbd5e1;overflow-wrap:anywhere;vertical-align:middle}
.total-remarks-cell{height:0.8cm;padding:0 8px;border:1px solid #cbd5e1;background:#fff;text-align:left;vertical-align:middle}
.total-remarks-label{font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em}
.total-label{text-align:right;font-size:11px;color:#0f172a;text-transform:uppercase;letter-spacing:.04em;font-weight:700}
.total-qty{font-size:13.5px;font-weight:700;color:#0369a1;text-align:center}
.product-code{display:block;font-size:11.5px;line-height:1.2;color:#334155;font-weight:700}
.product-name{display:block;font-size:12px;line-height:1.2;font-weight:600;color:#0f172a}
.requested{text-align:center;font-size:13.5px;font-variant-numeric:tabular-nums;font-weight:700}
td.blank{height:0.8cm;background:#fff;padding:0}
.signatures{margin-top:8px;margin-bottom:0;font-size:10px}
.sig-name-row{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.sig-name-block{flex:1;min-width:0}
.sig-name-label{font-size:11.5px;font-weight:700;color:#0f172a;margin-top:5px}
.sig-name-line{border-bottom:1px solid #64748b;height:26px}
.sig-guide{font-size:9.5px;color:#475569;margin-top:2px}
.sig-details-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:4px}
.sig-detail{display:flex;flex-direction:column;gap:5px;min-width:0}
.sig-detail-label{font-size:10px;font-weight:600;color:#475569;white-space:nowrap}
.sig-detail-box{width:100%;height:22px;border:1px solid #cbd5e1;border-radius:2px;background:#fff}
.document-footer{margin-top:8mm;border-top:2px solid #0284c7;padding-top:5px;font-size:9.5px;color:#64748b;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;break-inside:avoid}
.document-footer .footer-left strong{display:block;color:#475569;font-weight:700;margin-bottom:1px;font-size:10px}
.document-footer .footer-center{text-align:center;font-weight:700;color:#475569;font-size:10.5px}
.document-footer .footer-right{text-align:right}
.document-footer .footer-right strong{display:block;color:#475569;font-weight:700;margin-bottom:1px;font-size:10px}
@media print{html,body{width:210mm;height:auto;min-height:0;margin:0;padding:0;border:0}section{width:210mm;height:296.5mm;max-height:296.5mm;min-height:296.5mm;padding:8mm 12mm 8mm 12mm;page-break-inside:avoid;break-inside:avoid;overflow:hidden}}
@media screen{html{background:#e2e8f0}body{padding:20px 0;background:transparent}section{max-width:210mm;height:296.5mm;margin-bottom:36px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1)}}
</style></head><body>${groups.map(g=>{
  const totalQty = Number(g.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toFixed(4)).toString();
  const PAGE_SIZE = 18;
  const pageChunks = [];
  for (let i = 0; i < g.items.length; i += PAGE_SIZE) {
    pageChunks.push(g.items.slice(i, i + PAGE_SIZE));
  }
  if (!pageChunks.length) pageChunks.push([]);
  const totalPages = pageChunks.length;

  return pageChunks.map((chunk, pageIdx) => {
    const isLastPage = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;
    const emptyRowCount = Math.max(0, PAGE_SIZE - chunk.length);
    const emptyRows = Array.from({ length: emptyRowCount }, () =>
      `<tr class="fill-row"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="requested">&nbsp;</td><td class="blank"></td></tr>`
    ).join('');

    return `<section>
<div class="sheet-main">
  <header class="document-header">
    <div class="brand-block">
      <div class="brand-logo-badge">NBH</div>
      <div>
        <div class="brand">NBH ENTERPRISE</div>
        <div class="brand-sub">Warehouse &amp; Distribution · Enterprise ERP</div>
        <div class="warehouse-highlight-badge">
          <span class="wh-highlight-title">${escape(g.name || `Warehouse ${g.id}`).toUpperCase()}</span>
        </div>
      </div>
    </div>
    <div class="document-title">
      <h1>Onhold bill</h1>
      <div class="document-number-wrap"><span class="document-number">${escape(bill.heldNumber)}</span></div>
      <div class="brand-sub">Warehouse review copy</div>
      <div class="doc-badge-row">
        <span class="status-badge status-badge-${statusTone}"><span class="status-dot"></span>${escape(docStatus)}</span>
      </div>
    </div>
  </header>
  <div class="upper-grid">
    <div class="upper-left">
      <div class="document-meta">
        <div class="meta-card meta-customer">
          <span class="meta-label">Customer details</span>
          <div class="customer-identity"><div class="meta-sub">${escape(customerCode)}</div><div class="meta-value">${escape(customerName)}</div></div>
          <div class="meta-address-val">${escape(customerAddress) || '—'}</div>
        </div>
        <div class="meta-staff">
          <div class="meta-card"><span class="meta-label">Prepared by</span><div class="meta-value">${escape([bill.createdByName || bill.createdBy,bill.createdByEmployeeCode].filter(Boolean).join(' · ')) || 'Sales Staff'}</div></div>
          <div class="meta-card"><span class="meta-label">Billed at</span><div class="meta-value">${escape(savedAt)}</div></div>
        </div>
      </div>
      <div class="remarks"><strong>Remarks</strong>${escape(remarks) || '—'}</div>
    </div>
    <div class="packing-panel">
      <div class="packing-heading"><div class="packing-title">Packing counts</div><span class="packing-caption">Package quantities${totalPages > 1 && bill.warehousePacking?.[g.id] ? ' · Saved warehouse totals' : ''}</span></div>
      <div class="packing-form">
        ${packingFields.map(([key,label])=>`<div class="packing-box"><span class="packing-label">${label}:</span><div class="packing-val">${bill.warehousePacking?.[g.id]?.[key]!=null?escape(bill.warehousePacking[g.id][key]):'&nbsp;'}</div></div>`).join('')}
      </div>
    </div>
  </div>
  <table>
    <colgroup><col style="width:0.7cm"><col style="width:3.3cm"><col><col style="width:2cm"><col style="width:2cm"></colgroup>
    <thead>
      <tr class="sheet-reference"><th colspan="5">${escape(bill.heldNumber)} · ${escape(g.name)}<span>${g.items.length} product lines · Warehouse review · Page ${pageNum} of ${totalPages}</span></th></tr>
      <tr><th>#</th><th>Code</th><th>Product name</th><th>Requested qty</th><th>Adjusted qty</th></tr>
    </thead>
    <tbody>${chunk.map((i, idx) => {
      const itemNum = pageIdx * PAGE_SIZE + idx + 1;
      return `<tr><td>${itemNum}</td><td><span class="product-code">${escape(i.productSku)}</span></td><td><span class="product-name">${escape(i.productName)}</span></td><td class="requested">${escape(i.quantity)}</td><td class="blank"></td></tr>`;
    }).join('')}${emptyRows}</tbody>
    ${isLastPage ? `<tfoot>
      <tr class="table-total-row">
        <td colspan="2" class="total-remarks-cell"><span class="total-remarks-label">Remarks:</span></td>
        <td class="total-label">Total quantity</td>
        <td class="requested total-qty">${totalQty}</td>
        <td class="blank"></td>
      </tr>
    </tfoot>` : ''}
  </table>

</div>
<div class="sheet-bottom">
  <div class="signatures">
    <div class="sig-name-row">
      ${['Collected by', 'Checked by / warehouse keeper'].map(role => `<div class="sig-name-block">
        <div class="sig-details-row">
          <div class="sig-detail"><span class="sig-detail-label">Start time</span><div class="sig-detail-box"></div></div>
          <div class="sig-detail"><span class="sig-detail-label">End time</span><div class="sig-detail-box"></div></div>
          <div class="sig-detail"><span class="sig-detail-label">Date</span><div class="sig-detail-box"></div></div>
        </div>
        <div class="sig-name-line"></div>
        <div class="sig-name-label">${role}</div>
        <div class="sig-guide">Name &amp; Signature</div>
      </div>`).join('')}
    </div>
  </div>
  <footer class="document-footer"><div class="footer-left"><strong>NBH Enterprise - Confidential</strong><span>Internal warehouse use only</span></div><div class="footer-center">Page ${pageNum} of ${totalPages}</div><div class="footer-right"><strong>${escape(bill.heldNumber)} · Warehouse review copy</strong><span>Generated ${escape(printDate)} · Sri Lanka</span></div></footer>
</div></section>`;
  }).join('');
}).join('')}</body></html>`;
}

export function heldWarehouseBatchHtml(bills) {
  if (!bills.length) throw new Error('No onhold bills to print.');
  const documents = bills.map(bill => heldWarehouseHtml(bill));
  const bodyStart = documents[0].indexOf('<body>') + '<body>'.length;
  const sheets = documents.map(html => html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))).join('');
  const printName = warehousePrintName({heldNumber: bills.map(bill => bill.heldNumber).filter(Boolean).join(', ')});
  return documents[0].slice(0, bodyStart).replace(/<title>.*?<\/title>/, () => `<title>${escape(printName)}</title>`) + sheets + '</body></html>';
}

export function printHeldWarehouseSheets(bill, warehouse = '') {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups to print warehouse sheets.');
  popup.document.write(heldWarehouseHtml(bill, warehouse));
  popup.document.close();
  popup.focus();
  popup.print();
}

// Print the saved sheets directly, without opening another tab or application dialog.
export function printHeldWarehouseSheetsInline(bill) {
  const bills = Array.isArray(bill) ? bill : [bill];
  const html = heldWarehouseBatchHtml(bills);
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Onhold bill warehouse sheets';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: 'fixed',
      width: '210mm',
      height: '297mm',
      border: '0',
      top: '0',
      left: '-10000px',
      pointerEvents: 'none'
    });
    const printName = warehousePrintName({heldNumber: bills.map(saved => saved.heldNumber).filter(Boolean).join(', ')});
    let previousTitle;
    const cleanup = () => {
      if (previousTitle !== undefined && document.title === printName) document.title = previousTitle;
      frame.remove();
    };
    const fail = () => {
      cleanup();
      reject(new Error('Unable to open the print dialog.'));
    };
    frame.onerror = fail;
    frame.onload = () => {
      frame.onload = null;
      try {
        const printWindow = frame.contentWindow;
        if (!printWindow) throw new Error('Print frame unavailable');
        previousTitle = document.title;
        document.title = printName;
        printWindow.document.title = printName;
        printWindow.addEventListener('afterprint', () => { cleanup(); resolve(); }, { once: true });
        printWindow.focus();
        printWindow.print();
      } catch {
        fail();
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
