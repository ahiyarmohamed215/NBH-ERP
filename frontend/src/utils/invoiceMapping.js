export const invoiceTotal = invoice => Number(invoice.netTotal ?? invoice.totalAmount ?? 0);
export const formatBusinessDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const buildSalesReturnPayload = (form) => ({
  invoiceId: Number(form.invoiceId),
  returnType: form.returnType || 'CREDIT_NOTE',
  reason: [form.reason, form.remarks].filter(Boolean).join(' — '),
  items: form.items.filter(item => Number(item.quantityReturned) > 0).map(item => ({
    invoiceItemId: Number(item.invoiceItemId), productId: Number(item.productId),
    quantity: Number(item.quantityReturned), unitPrice: Number(item.unitPrice),
    conditionType: item.restockable ? 'RESTOCKABLE' : 'DAMAGED',
  })),
});
