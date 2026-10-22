import React from 'react';
import { Ban, Layers } from 'lucide-react';
import StatusBadge from './StatusBadge';
import './MergedHeldBills.css';
import { hasPermission } from '../utils/moduleAccess';

export default function MergedHeldBills({ bills = [], user, onView, onCancel }) {
  if (!bills.length) return null;
  return (
    <section className="merged-held-bills" aria-label="Merged Onhold Bills">
      <div className="merged-held-bills-header">
        <Layers size={15} className="merged-held-icon" />
        <h4 className="erp-section-title">Merged Onhold Bills ({bills.length})</h4>
      </div>
      <div className="erp-table-frame erp-table-scroll">
        <table className="erp-table">
          <thead>
            <tr>
              {['Onhold Bill', 'Amount', 'Status', 'Actions'].map((label) => (
                <th className="erp-table-heading" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="erp-table-cell">
                  <button
                    className="merged-held-bill-link erp-table-code"
                    type="button"
                    onClick={() => onView(bill)}
                  >
                    {bill.number}
                  </button>
                </td>
                <td className="erp-table-cell" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  LKR {Number(bill.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="erp-table-cell">
                  <StatusBadge status={bill.status} />
                </td>
                <td className="erp-table-cell erp-table-actions">
                  {bill.status === 'INVOICE_CREATED' && hasPermission(user, 'SALES_EDIT') && (
                    <button
                      type="button"
                      className="erp-table-icon-action"
                      data-tone="danger"
                      aria-label={`Cancel ${bill.number} from invoice`}
                      title="Cancel this bill from the invoice"
                      onClick={() => onCancel({ ...bill, heldNumber: bill.number })}
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
