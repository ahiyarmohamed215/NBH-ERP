export const historyDocumentReference = (data) => data.paymentNumber || data.receiptNo || data.voucherNo || data.chequeNo || data.invoiceNumber || data.id;

export const historyFieldLabel = (key) => key.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

export function historyDetailRows(data, prefix = '') {
  return Object.entries(data || {}).flatMap(([key, value]) => {
    if (value == null || value === '' || key === 'displayDate') return [];
    const label = `${prefix}${historyFieldLabel(key)}`;
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) => typeof entry === 'object'
        ? historyDetailRows(entry, `${label} ${index + 1} · `)
        : [{ label: `${label} ${index + 1}`, value: String(entry) }]);
    }
    if (typeof value === 'object') return historyDetailRows(value, `${label} · `);
    let formatted = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    if (/date|At$/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(formatted)) {
      const date = new Date(formatted.length === 10 ? `${formatted}T00:00:00` : formatted);
      if (!Number.isNaN(date.getTime())) formatted = date.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        ...(String(value).length > 10 ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : {}),
      });
    } else if (/amount|total|price|balance/i.test(key) && Number.isFinite(Number(value))) {
      formatted = `LKR ${Number(value).toFixed(2)}`;
    }
    return [{ label, value: formatted }];
  });
}
