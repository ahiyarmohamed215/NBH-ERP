import {posRemarks, isCancelledBill} from './billRemarks.js';
import {packingFields} from './invoicePacking.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

export function heldBillHtml(bill) {
  const money = value => Number(value || 0).toFixed(2);
  const isCancelled = isCancelledBill(bill);
  const statusLabel = isCancelled ? 'CANCELLED' : (bill.status === 'STOCK_ADJUSTED' ? 'WAREHOUSE REVIEWED' : (bill.status === 'YET_TO_PRINT' ? 'SENT TO WAREHOUSE' : (bill.status || 'BILLED').replace(/_/g, ' ')));
  const remarks = posRemarks(bill);
  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const items = (bill.items || []).map((line, idx) => {
    const gross = Math.round(Number(line.quantity || 0) * Number(line.unitPrice || 0) * 100) / 100;
    const rate = Number(line.discountRate || 0);
    const discount = line.discountAmount != null ? Number(line.discountAmount) : Math.round(gross * rate) / 100;
    const effectiveRate = rate || (gross > 0 ? (discount / gross) * 100 : 0);
    const lineTotal = line.totalPrice != null ? Number(line.totalPrice) : gross - discount;
    return {
      idx: idx + 1,
      productName: line.productName,
      productSku: line.productSku,
      unitPrice: line.unitPrice,
      quantity: Number(line.quantity || 0),
      gross,
      effectiveRate,
      discount,
      lineTotal
    };
  });

  const totalGross = items.reduce((sum, i) => sum + i.gross, 0);
  const totalItemDiscounts = items.reduce((sum, i) => sum + i.discount, 0);
  const billDiscount = Number(bill.discountAmount || 0);
  const taxAmount = Number(bill.taxAmount || 0);
  const netTotal = bill.netTotal != null ? Number(bill.netTotal) : (totalGross - totalItemDiscounts - billDiscount + taxAmount);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Held Bill ${escape(bill.heldNumber)}</title><style>
@page{size:A4 portrait;margin:12mm 14mm 16mm 14mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{margin:0;padding:0;font:11px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#fff}

/* ── Header ── */
.document-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:0 0 14px;border-bottom:2.5px solid #0284c7;margin-bottom:12px}
.brand-block{display:flex;align-items:center;gap:12px}
.brand-logo-badge{width:42px;height:42px;background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;letter-spacing:-.03em;box-shadow:0 3px 8px rgba(2,132,199,0.28)}
.brand{font-size:22px;line-height:1.15;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.brand-sub{font-size:8.5px;letter-spacing:.12em;color:#0284c7;margin-top:3px;text-transform:uppercase;font-weight:700}

.document-title{text-align:right;min-width:210px}
h1{font-size:21px;line-height:1.15;margin:0 0 4px;font-weight:900;color:#0284c7;text-transform:uppercase;letter-spacing:.04em}
.document-number-wrap{margin-bottom:3px}
.document-number{display:inline-block;font-size:13px;font-weight:900;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.04em;color:#0369a1;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:5px;padding:2px 10px;overflow-wrap:anywhere}
.doc-badge-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:4px}
.status-badge{display:inline-flex;align-items:center;gap:5px;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 10px;border-radius:9999px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd}
.status-badge-cancelled{background:#fee2e2;color:#dc2626;border-color:#fca5a5}
.status-dot{width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block}
.doc-timestamp{font-size:8.5px;color:#64748b;font-weight:600}

/* ── Metadata Grid ── */
.document-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px}
.meta-card{display:flex;flex-direction:column}
.meta-label{display:block;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:800;margin-bottom:3px}
.meta-value{font-size:12px;line-height:1.35;font-weight:800;overflow-wrap:anywhere;color:#0f172a}

.remarks-box{border-left:3.5px solid #0284c7;background:#f0f9ff;border-top:1px solid #e0f2fe;border-right:1px solid #e0f2fe;border-bottom:1px solid #e0f2fe;border-radius:6px;padding:8px 14px;margin:0 0 10px;font-size:10.5px;color:#0f172a}
.remarks-box strong{display:block;margin-bottom:3px;color:#0369a1;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
.cancel-box{border-left:3.5px solid #dc2626;background:#fef2f2;border-top:1px solid #fee2e2;border-right:1px solid #fee2e2;border-bottom:1px solid #fee2e2;border-radius:6px;padding:8px 14px;margin:0 0 10px;font-size:10.5px;color:#991b1b}
.cancel-box strong{display:block;margin-bottom:3px;color:#dc2626;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}

/* ── Table ── */
table.items{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 14px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden}
table.items thead{display:table-header-group}
table.items tr{break-inside:avoid}
table.items th{background:linear-gradient(180deg,#0284c7 0%,#0369a1 100%);color:#ffffff;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border:0;border-right:1px solid #0284c7;text-align:left}
table.items th:last-child{border-right:0}
table.items th.num-col{text-align:right}
table.items th.center-col{text-align:center}
table.items tbody tr:nth-child(even){background:#f8fafc}
table.items td{padding:8px 10px;border:1px solid #e2e8f0;font-size:10px;overflow-wrap:anywhere;vertical-align:middle;color:#0f172a}
table.items td.num-col{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700}
table.items td.center-col{text-align:center;font-weight:800}
.product-name{font-weight:800;color:#0f172a;margin-bottom:2px}
.product-sku{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:8.5px;color:#0284c7;background:#e0f2fe;border:1px solid #bae6fd;border-radius:3px;padding:1px 5px;font-weight:700}

/* ── Bottom Section ── */
.below-table-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-top:12px;break-inside:avoid}
.info-column{display:flex;flex-direction:column;gap:10px}
.totals-column{display:flex;flex-direction:column}

.packing-panel{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;background:#f8fafc}
.panel-title{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:6px}
.packing-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.packing-cell{background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;overflow:hidden;text-align:center}
.packing-cell span{display:block;padding:3px 4px;background:#f1f5f9;font-size:7.5px;font-weight:800;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #cbd5e1}
.packing-value{height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#0284c7}

.terms-panel{font-size:8.5px;line-height:1.45;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
.terms-panel strong{color:#0f172a}

.totals-card{border:1.5px solid #0284c7;border-radius:8px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(2,132,199,0.08)}
.totals-table{width:100%;border-collapse:collapse;margin:0;border:0}
.totals-table td{padding:5px 12px;border:0;border-bottom:1px solid #f1f5f9;font-size:9.5px;color:#475569}
.totals-table td:last-child{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;color:#0f172a}
.totals-table .net-row td{background:#f0f9ff;font-size:12px;font-weight:900;color:#0284c7;border-top:1.5px solid #0284c7;border-bottom:0}
.totals-table .net-row td:last-child{color:#0284c7;font-size:14px}

.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:18px;break-inside:avoid}
.signatures div{border-top:2px solid #0284c7;padding-top:6px;font-size:8.5px;color:#475569}
.sig-role{font-weight:800;color:#0f172a;margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.sig-guide{font-size:7.5px;color:#94a3b8}

.document-footer{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:8px;color:#64748b;display:flex;justify-content:space-between;gap:16px;break-inside:avoid;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.document-footer span:last-child{text-align:right}

@media print{html,body{width:auto;height:auto;min-height:0;margin:0;padding:0;border:0;overflow:visible}}
@media screen{html{background:#e2e8f0}body{max-width:210mm;margin:20px auto;padding:32px 36px;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.document-footer{position:static;margin-top:16px}}
</style></head><body>
<header class="document-header">
  <div class="brand-block">
    <div class="brand-logo-badge">NBH</div>
    <div>
      <div class="brand">NBH ENTERPRISE</div>
      <div class="brand-sub">Warehouse &amp; Distribution · Enterprise ERP</div>
    </div>
  </div>
  <div class="document-title">
    <h1>Held Bill ${escape(bill.heldNumber)}</h1>
    <div class="document-number-wrap"><span class="document-number">${escape(bill.heldNumber)}</span></div>
    <div class="brand-sub">Customer Onhold Copy</div>
    <div class="doc-badge-row">
      <span class="status-badge ${isCancelled ? 'status-badge-cancelled' : ''}"><span class="status-dot"></span>${escape(statusLabel)}</span>
      <span class="doc-timestamp">${escape(printDate)}</span>
    </div>
  </div>
</header>

<div class="document-meta">
  <div class="meta-card"><span class="meta-label">Customer</span><div class="meta-value">${escape(bill.customerName)}</div></div>
  <div class="meta-card"><span class="meta-label">Bill date</span><div class="meta-value">${escape((bill.createdAt || bill.invoiceDate)?.slice(0,10)) || '—'}</div></div>
  <div class="meta-card"><span class="meta-label">Staff</span><div class="meta-value">${escape([bill.createdByName || bill.createdBy,bill.createdByEmployeeCode].filter(Boolean).join(' · ')) || 'Sales Staff'}</div></div>
  <div class="meta-card"><span class="meta-label">Status</span><div class="meta-value">${escape(statusLabel)}</div></div>
</div>

${remarks ? `<div class="remarks-box"><strong>Remarks</strong><br>${escape(remarks)}</div>` : ''}
${isCancelled && bill.cancellationReason ? `<div class="cancel-box"><strong>Cancellation reason</strong><br>${escape(bill.cancellationReason)}</div>` : ''}

<table class="items">
  <thead>
    <tr>
      <th style="width: 32%;">Product</th>
      <th class="num-col" style="width: 12%;">Unit price</th>
      <th class="center-col" style="width: 10%;">Selling qty</th>
      <th class="num-col" style="width: 12%;">Sub line total</th>
      <th class="num-col" style="width: 10%;">Discount %</th>
      <th class="num-col" style="width: 11%;">Discount Rs.</th>
      <th class="num-col" style="width: 13%;">Line total</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(i => `<tr>
      <td><div class="product-name">${escape(i.productName)}</div><span class="product-sku">${escape(i.productSku)}</span></td>
      <td class="num-col">${money(i.unitPrice)}</td>
      <td class="center-col">${i.quantity}</td>
      <td class="num-col">${money(i.gross)}</td>
      <td class="num-col">${money(i.effectiveRate)}%</td>
      <td class="num-col">${money(i.discount)}</td>
      <td class="num-col">${money(i.lineTotal)}</td>
    </tr>`).join('')}
    ${!items.length ? `<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">No products in this held bill.</td></tr>` : ''}
  </tbody>
</table>

<div class="below-table-grid">
  <div class="info-column">
    ${bill.packing || bill.warehousePacking ? `
    <div class="packing-panel">
      <div class="panel-title">Package Counts</div>
      <div class="packing-grid">
        ${packingFields.map(([key, label]) => {
          const val = bill.packing?.[key] ?? Object.values(bill.warehousePacking || {}).reduce((s, p) => s + Number(p?.[key] || 0), 0);
          return `<div class="packing-cell"><span>${label}</span><div class="packing-value">${val != null && val !== '' ? escape(val) : '0'}</div></div>`;
        }).join('')}
      </div>
    </div>` : ''}
    <div class="terms-panel">
      <strong>Terms &amp; Important Notice:</strong><br>
      • Official onhold sales order / reservation record.<br>
      • Prices and inventory availability are held subject to final commercial invoicing.<br>
      • Thank you for doing business with NBH Enterprise!
    </div>
  </div>

  <div class="totals-column">
    <div class="totals-card">
      <table class="totals-table">
        <tr><td>Gross Subtotal (LKR):</td><td>${money(totalGross)}</td></tr>
        <tr><td>Item Discounts (LKR):</td><td>${money(totalItemDiscounts)}</td></tr>
        <tr><td>Bill discount (LKR):</td><td>${money(billDiscount)}</td></tr>
        <tr><td>Tax (LKR):</td><td>${money(taxAmount)}</td></tr>
        <tr class="net-row"><td>Bill total (LKR):</td><td>${money(netTotal)}</td></tr>
      </table>
    </div>
  </div>
</div>

<div class="signatures">
  <div><div class="sig-role">Checked by / warehouse keeper</div><div class="sig-guide">Staff Signature &amp; Date</div></div>
  <div><div class="sig-role">Authorized Signature</div><div class="sig-guide">Management Sign-off</div></div>
  <div><div class="sig-role">Customer Acknowledgment</div><div class="sig-guide">Received / Accepted By</div></div>
</div>

<footer class="document-footer">
  <span>NBH Enterprise · Confidential Business Record</span>
  <span>Held bill · System Generated</span>
</footer>
</body></html>`;
}

export function printHeldBill(bill) {
  const printWindow = window.open('', '_blank', 'width=950,height=800');
  if (!printWindow) {
    alert('Please allow popups to print / export this document.');
    return;
  }
  const html = heldBillHtml(bill);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (_) {}
  }, 250);
}
