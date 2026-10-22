const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function warehouseGroups(bill) {
  const groups=new Map();
  for(const item of bill.items || []){const id=String(item.warehouseId || bill.warehouseId);if(!groups.has(id))groups.set(id,{id,name:item.warehouseName || bill.warehouseName,items:[]});groups.get(id).items.push(item);}
  return [...groups.values()];
}
export function heldWarehouseHtml(bill,warehouse='') {
  const groups=warehouseGroups(bill).filter(g=>!warehouse || g.id===String(warehouse));
  return `<!doctype html><html><head><title>${escape(bill.heldNumber)} Warehouse review</title><style>@page{size:A4;margin:15mm}body{font:12px Arial;color:#111}section{break-after:page}section:last-child{break-after:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px 6px;border:1px solid #888;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:20px}td.blank{min-width:65px;height:32px}.sign{margin-top:30px}</style></head><body>${groups.map(g=>`<section><h1>Warehouse review — ${escape(g.name)}</h1><p>Held bill: <strong>${escape(bill.heldNumber)}</strong> · Customer: ${escape(bill.customerName)}</p><p>Created by: ${escape(bill.createdBy)}</p><p>Write approved order quantities and return this sheet to the office.</p><table><thead><tr><th>Code / product</th><th>Requested</th><th>Approved qty</th><th>Remarks</th></tr></thead><tbody>${g.items.map(i=>`<tr><td>${escape(i.productSku)}<br>${escape(i.productName)}</td><td>${escape(i.quantity)} ${escape(i.unitOfMeasure)}</td><td class="blank"></td><td class="blank"></td></tr>`).join('')}</tbody></table><p class="sign">Checked by: ____________________ Date: __________ Signature: __________</p></section>`).join('')}</body></html>`;
}
export function printHeldWarehouseSheets(bill,warehouse='') {
  const popup=window.open('','_blank');if(!popup)throw new Error('Allow pop-ups to print warehouse sheets.');popup.document.write(heldWarehouseHtml(bill,warehouse));popup.document.close();popup.focus();popup.print();
}
