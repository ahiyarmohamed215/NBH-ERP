import { executeA4Print } from './printReport';

const escapeText = value => String(value ?? '—').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function groupPrnItems(prn) {
  const groups = new Map();
  for (const item of prn.items || []) {
    const supplierId = item.supplierId ?? prn.supplierId ?? item.supplierName ?? prn.supplierName;
    const warehouseId = item.warehouseId ?? prn.warehouseId ?? item.warehouseName ?? prn.warehouseName;
    const key = JSON.stringify([supplierId, warehouseId]);
    if (!groups.has(key)) groups.set(key, {supplierName:item.supplierName || prn.supplierName,
      warehouseName:item.warehouseName || prn.warehouseName, items:[]});
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

export function buildPrnPrintHtml(prn) {
  const groups = groupPrnItems(prn);
  const sheets = groups.map((group,index)=>`<section class="prn-sheet" data-print-group="${index+1}">
    <header><div><strong>NBH ENTERPRISE</strong><p>Purchase return note</p></div><div><h1>${escapeText(prn.prnNumber)}</h1><p>Copy ${index+1} of ${groups.length} · ${escapeText(prn.status)}</p></div></header>
    <div class="details"><div><span>Supplier</span><b>${escapeText(group.supplierName)}</b></div><div><span>Dispatch warehouse</span><b>${escapeText(group.warehouseName)}</b></div><div><span>Return date</span><b>${escapeText(prn.returnDate || prn.createdAt?.slice(0,10))}</b></div></div>
    <table><thead><tr><th>Product code</th><th>Product name</th><th>Original GRN</th><th>Qty</th><th>Unit cost (LKR)</th><th>Reason</th><th>Remarks / notes</th></tr></thead><tbody>
    ${group.items.map(item=>`<tr><td>${escapeText(item.productSku || item.sku)}</td><td>${escapeText(item.productName)}</td><td>${escapeText(item.originalGrnNumber || prn.originalGrnNumber)}</td><td class="number">${escapeText(item.quantityReturned)}</td><td class="number">${Number(item.unitCost || 0).toFixed(2)}</td><td>${escapeText(item.reason || prn.reason)}</td><td>${escapeText(item.remarks || prn.remarks)}</td></tr>`).join('')}
    </tbody></table><div class="signatures"><div>Issued by warehouse<br><br>Name / signature: ___________________<br>Date: ___________________</div><div>Accepted by supplier<br><br>Name / signature: ___________________<br>Date: ___________________</div></div>
    <footer>${escapeText(prn.prnNumber)} · Supplier / warehouse copy ${index+1}</footer>
  </section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escapeText(prn.prnNumber)} — Purchase return</title><style>
    @page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#1e293b;font-size:11px}
    .prn-sheet{break-before:page;page-break-before:always}.prn-sheet:first-child{break-before:auto;page-break-before:auto}
    header{display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:18px}header>div:last-child{text-align:right}
    header strong{font-size:17px;color:#2563eb}h1{font-size:17px;margin:0}p{margin:5px 0;color:#64748b}
    .details{display:flex;gap:24px;margin-bottom:20px}.details div{flex:1}.details span{display:block;font-size:10px;color:#64748b;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:#eff6ff;text-align:left;font-size:10px}td,th{padding:8px 5px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}tr{break-inside:avoid}th:nth-child(2){width:21%}th:nth-child(4){width:7%}.number{text-align:right}
    .signatures{display:flex;gap:40px;margin-top:35px;break-inside:avoid}.signatures div{flex:1;line-height:1.8}footer{margin-top:25px;color:#64748b;font-size:9px}
    @media print{th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media screen{body{padding:30px}.prn-sheet+.prn-sheet{margin-top:50px}}
  </style></head><body>${sheets}</body></html>`;
}

export function printPrnDocument(prn) {
  return executeA4Print(buildPrnPrintHtml(prn), prn.prnNumber);
}
