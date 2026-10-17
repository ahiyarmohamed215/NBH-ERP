import React from 'react';
import RecordDetailsModal from './RecordDetailsModal';
import RecordActions from './RecordActions';
import { staffCode } from '../utils/staffCode';
import './SupplierDetailsModal.css';

export default function EmployeeDetailsModal({
  employee = {},
  onClose,
  onPrint,
  onEdit,
  onStatusChange,
  onDelete,
  canManage = true,
  isSuperAdmin = false,
  currentUser = {},
}) {
  const formatRoleName = (rName) => {
    if (!rName) return 'Staff';
    if (typeof rName !== 'string') rName = rName?.name || '';
    if (rName.startsWith('ROLE_')) {
      const clean = rName.replace('ROLE_', '');
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return rName;
  };

  const getPrimaryRole = (user) => {
    if (!user.roles || user.roles.length === 0) return 'Employee';
    const mainRole = user.roles.find((r) => (typeof r === 'string' ? r : r?.name) === 'ROLE_ADMIN') || user.roles[0];
    return formatRoleName(typeof mainRole === 'string' ? mainRole : mainRole?.name);
  };

  const formatJoinedDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const status =
    employee.status ||
    (employee.approvalStatus && employee.approvalStatus.toUpperCase() === 'PENDING'
      ? 'DRAFT'
      : employee.approvalStatus && employee.approvalStatus.toUpperCase() === 'DRAFT'
      ? 'DRAFT'
      : employee.isActive
      ? 'ACTIVE'
      : 'INACTIVE');

  const details = [
    ['Staff code', staffCode(employee)],
    ['Full name', employee.fullName || '—'],
    ['Username', `@${employee.username}`],
    ['Primary role', getPrimaryRole(employee)],
    [
      'Assigned roles',
      (employee.roles || [])
        .map((r) => formatRoleName(typeof r === 'string' ? r : r?.name))
        .join(', ') || 'Employee',
    ],
    [
      'Phone',
      employee.phone ? (
        <a className="supplier-card-link" href={'tel:' + employee.phone}>
          {employee.phone}
        </a>
      ) : null,
    ],
    [
      'Email',
      employee.email ? (
        <a className="supplier-card-link" href={'mailto:' + employee.email}>
          {employee.email}
        </a>
      ) : null,
    ],
    ['Employment type', employee.employeeType || 'Full-time'],
    ['Joined date', formatJoinedDate(employee.createdAt)],
  ];

  return (
    <RecordDetailsModal
      label="Employee details"
      title={employee.fullName || employee.username || '—'}
      subtitle={`Employee · @${employee.username} · ${staffCode(employee)}`}
      status={status}
      details={details}
      onClose={onClose}
      onPrint={onPrint}
      printTitle="Print Employee Profile (A4)"
      className="supplier-inspection supplier-floating-card"
      allowDraftPrint={true}
      actions={
        <RecordActions
          name="Employee"
          status={status}
          canManage={canManage && !isSuperAdmin}
          compact={true}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onDelete={
            canManage && !isSuperAdmin && String(employee.id) !== String(currentUser?.id)
              ? onDelete
              : undefined
          }
          className="master-details-management supplier-card-actions"
        />
      }
    />
  );
}
