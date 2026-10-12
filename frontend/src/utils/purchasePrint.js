import { gtnWarehouseSummary } from './gtnRoutes';
import { printA4Report } from './printReport';

export function printPurchaseList(type, records) {
  const escapeText = value => String(value ?? '—').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const fields = {
    GTN: [['GTN number', row => row.gtnNumber], ['Warehouse', row => gtnWarehouseSummary(row).text], ['Total products', row => new Set((row.items || []).map(item => item.productId)).size], ['Date', row => row.dispatchDate || row.createdAt?.slice(0, 10)], ['Status', row => row.status?.replaceAll('_',' ')], ['Remarks', row => row.notes || row.remarks]],
    PRN: [['PRN number', row => row.prnNumber], ['Supplier', row => row.supplierName], ['Warehouse', row=>row.warehouseName], ['Total products', row=>new Set((row.items || []).map(item=>item.productId)).size], ['Date', row => row.returnDate || row.createdAt?.slice(0, 10)], ['Status', row=>row.status], ['Remarks', row=>row.notes || row.remarks]],
    PO: [['PO number', row => row.poNumber], ['Supplier', row => row.supplierName], ['Order date', row => row.orderDate]],
  }[type];
  const columns = ['GTN','PRN'].includes(type) ? fields : [...fields, ['Total products', row => new Set((row.items || []).map(item => item.productId)).size], ['Status', row => row.status?.replaceAll('_',' ')]];
  printA4Report({
    title: `${type} records`,
    columns: columns.map(([header], index) => ({ header, accessor: String(index) })),
    data: records.map(row => Object.fromEntries(columns.map(([, value], index) => [String(index), escapeText(value(row))]))),
  });
}
