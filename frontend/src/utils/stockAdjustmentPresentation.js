import {printA4Report} from './printReport';

export const adjustmentStatus = record => {
  const status = String(record.status || 'DRAFT').toUpperCase();
  if (['PROCESSED', 'COMPLETED', 'STOCK_ADJUSTED', 'ADJUSTED'].includes(status)) return 'ADJUSTED';
  if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(status)) return 'CANCELLED';
  return 'DRAFT';
};

export const adjustmentQuantity = record => {
  const quantity = Number(record.quantity || 0);
  return `${quantity > 0 ? '+' : ''}${quantity.toLocaleString()}`;
};

const escapeText = value => String(value ?? '—').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function printStockAdjustment(record) {
  const details = [['Adjustment code', record.recordNo], ['Type', record.type], ['Warehouse', record.warehouse], ['Product code', record.sku], ['Product name', record.productName], ['Qty adjusted', adjustmentQuantity(record)], ['Date', record.date], ['Status', adjustmentStatus(record)], ['Reason', record.reason], ['Linked GRN', record.sourceGrnNumber]];
  printA4Report({title:'Stock Adjustment', metaItems:[{label:'Adjustment code', value:escapeText(record.recordNo)}], columns:[{header:'Field', accessor:'field'}, {header:'Details', accessor:'value'}], data:details.map(([field,value])=>({field,value:escapeText(value)}))});
}
