export function outstandingPaymentStatus(invoice) {
  const status=String(invoice.paymentStatus || invoice.status || '').toUpperCase();
  return Number(invoice.paidAmount || 0)>0 || ['PARTIAL','PARTIALLY_PAID'].includes(status) ? 'PARTIAL' : 'UNPAID';
}
export function customerOutstandingInvoices(invoices=[], customerId) {
  return invoices.filter(invoice => Number(invoice.balanceAmount || 0)>0
    && ['COMPLETED','PARTIAL','PARTIALLY_PAID','PAID','UNPAID','OVERDUE'].includes(String(invoice.status || '').toUpperCase())
    && (customerId==null || invoice.customerId==null || String(invoice.customerId)===String(customerId)));
}
