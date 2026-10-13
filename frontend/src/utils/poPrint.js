import {purchaseSellingPrice} from './purchaseSellingPrice';
import { executeA4Print } from './printReport';

const escape = value => String(value ?? '—').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const purchaseOrderDate = order => order.createdAt?.slice(0,10) || order.orderDate?.slice(0,10) || '';

export function groupPoItems(order) {
  const groups=new Map();
  for(const item of order.items || []) {
    const key=item.supplierId ?? order.supplierId ?? item.supplierName ?? order.supplierName;
    if(!groups.has(key)) groups.set(key,{supplierName:item.supplierName || order.supplierName,items:[]});
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

export function buildPoPrintHtml(orders) {
  const documents=Array.isArray(orders) ? orders : [orders];
  const sheets=documents.flatMap(order=>groupPoItems(order).map((group,index)=>{
    const total=group.items.reduce((sum,item)=>sum+Number(item.quantity || 0)*purchaseSellingPrice(item),0);
    return `<section class="po-sheet"><header><div><strong>NBH ENTERPRISE</strong><p>Purchase order</p></div><div><h1>${escape(order.poNumber)}</h1><p>${escape(order.status?.replaceAll('_',' '))}</p></div></header>
      <div class="details"><div><span>Supplier</span><b>${escape(group.supplierName)}</b></div><div><span>Created date</span><b>${escape(purchaseOrderDate(order))}</b></div></div>
      <p class="remarks"><b>Remarks:</b> ${escape(order.notes)}</p>
      <table><thead><tr><th>Product code</th><th>Product name</th><th>Destination warehouse</th><th>Qty</th><th>Selling price (LKR)</th><th>Line total (LKR)</th></tr></thead><tbody>${group.items.map(item=>`<tr><td>${escape(item.sku || item.productSku)}</td><td>${escape(item.productName)}</td><td>${escape(item.warehouseName || order.warehouseName)}</td><td class="number">${escape(item.quantity)}</td><td class="number">${purchaseSellingPrice(item).toFixed(2)}</td><td class="number">${(Number(item.quantity || 0)*purchaseSellingPrice(item)).toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="total">Supplier total: LKR ${total.toFixed(2)}</div><footer>${escape(order.poNumber)} · Supplier copy ${index+1} of ${groupPoItems(order).length}</footer></section>`;
  })).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Purchase orders</title><style>
    @page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#1e293b;font-size:11px}
    .po-sheet{break-before:page;page-break-before:always}.po-sheet:first-child{break-before:auto;page-break-before:auto}
    header{display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:18px}header>div:last-child{text-align:right}
    header strong{font-size:17px;color:#2563eb}h1{font-size:17px;margin:0}p{margin:5px 0;color:#64748b}
    .details{display:flex;gap:24px;margin-bottom:14px}.details div{flex:1}.details span{display:block;font-size:10px;color:#64748b;margin-bottom:5px}.remarks{white-space:pre-wrap;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:#eff6ff;text-align:left;font-size:10px}td,th{padding:8px 5px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}tr{break-inside:avoid}th:nth-child(2){width:24%}th:nth-child(4){width:8%}.number{text-align:right}
    .total{text-align:right;font-weight:bold;margin-top:18px;break-inside:avoid}footer{margin-top:25px;color:#64748b;font-size:9px}
    @media print{th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media screen{body{padding:30px}.po-sheet+.po-sheet{margin-top:50px}}
  </style></head><body>${sheets}</body></html>`;
}

export const printPurchaseOrder = order => executeA4Print(buildPoPrintHtml(order),order.poNumber);
export const printPurchaseOrders = orders => executeA4Print(buildPoPrintHtml(orders),'Purchase orders');
