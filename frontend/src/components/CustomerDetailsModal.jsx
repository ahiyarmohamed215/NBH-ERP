import React from 'react';
import {Ban, CheckCircle, Edit2, History} from 'lucide-react';
import RecordDetailsModal from './RecordDetailsModal';
import './RecordActions.css';

const money = value => `LKR ${Number(value || 0).toLocaleString('en-LK', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

export default function CustomerDetailsModal({customer, status, groups, canManage, onClose, onEdit, onStatusChange, onHistory, onPrint}) {
  const balance = Number(customer.currentBalance || 0);
  const staff = [...new Set(groups.map(group => group.assignedStaffName || group.salesmanName).filter(Boolean))];
  return <RecordDetailsModal label="Customer details" title={customer.name} subtitle={`Customer · ${customer.code || customer.customerCode || '—'}`}
    status={status} onClose={onClose} onPrint={onPrint} printTitle="Print Customer Statement (A4)" allowDraftPrint
    className="customer-details-modal master-details-uniform"
    details={[
      ['Contact person', customer.contactPerson], ['Phone', customer.phone], ['Email', customer.email],
      ['Credit Limit', money(customer.creditLimit)], ['Current balance', money(balance)],
      ['Credit status', balance > Number(customer.creditLimit || 0) ? 'Exceeded limit' : 'Within limit'],
      ['Customer groups', groups.map(group => group.name || group.groupName).join(', ') || 'Unassigned'],
      ['Assigned staff', staff.join(', ') || 'None assigned'], ['Customer ID', customer.id],
      ['Address', customer.address, true],
    ]}
    actions={<div className="purchase-inspection-detail-actions record-actions master-details-management" aria-label="Customer management actions">
      {canManage && <>
        <button type="button" className="btn btn-glass erp-button" disabled={status === 'INACTIVE'} onClick={onEdit}
          title={status === 'INACTIVE' ? 'Activate this customer before editing' : undefined}>
          <Edit2 size={14}/>{status === 'DRAFT' ? 'Continue Draft' : 'Edit Customer'}
        </button>
        <button type="button" className={`btn btn-glass erp-button ${status === 'ACTIVE' ? 'purchase-inspection-warning' : 'purchase-inspection-success'}`} onClick={onStatusChange}>
          {status === 'ACTIVE' ? <Ban size={14}/> : <CheckCircle size={14}/>}{status === 'ACTIVE' ? 'Deactivate Customer' : 'Activate Customer'}
        </button>
      </>}
      <button type="button" className="btn btn-glass erp-button" onClick={onHistory}><History size={14}/> View Financial History</button>
    </div>}/>
}
