export const posRemarks = bill => bill.posRemarks ?? bill.notes ?? bill.remarks ?? '';
export const isCancelledBill = bill => ['CANCELLED','INVOICE_CANCELLED','VOIDED'].includes(bill.status);
