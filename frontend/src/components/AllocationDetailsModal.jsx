import React from 'react';
import { UserRound, Calendar, MessageSquare, ShieldCheck, Edit2, Ban, CheckCircle, Trash2 } from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';
import { allocationCode } from './AllocationTable';
import { printA4Report } from '../utils/printReport';
import { staffCode } from '../utils/staffCode';
import './PurchaseInspectionModal.css';

const escapeText = (value) => String(value ?? '—').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export default function AllocationDetailsModal({ allocation: q, status, canManage, busy, onClose, onEdit, onStatusChange, onDelete }) {
  const staff = q.userFullName || q.username || 'Staff not selected';
  const staffCd = q.userEmployeeCode || (q.userId ? staffCode({ id: q.userId }) : '—');
  const items = q.items && q.items.length > 0 ? q.items : [q];

  const actions = [];
  if (canManage) {
    if (onEdit) actions.push({ label: 'Edit Allocation', icon: Edit2, onClick: onEdit, disabled: busy });
    if (status !== 'DRAFT' && onStatusChange) {
      if (status === 'ACTIVE') {
        actions.push({
          label: 'Deactivate Allocation',
          icon: Ban,
          onClick: () => onStatusChange('INACTIVE'),
          disabled: busy,
          tone: 'warning',
        });
      } else {
        const activationDisabled = busy || (!q.productId && (!q.items || q.items.length === 0));
        actions.push({
          label: `${status === 'INACTIVE' ? 'Reactivate' : 'Activate'} Allocation`,
          icon: CheckCircle,
          onClick: () => onStatusChange('ACTIVE'),
          disabled: activationDisabled,
          tone: 'success',
        });
      }
    }
    if (onDelete) {
      actions.push({
        label: 'Delete Allocation',
        icon: Trash2,
        onClick: onDelete,
        disabled: busy,
        tone: 'danger',
      });
    }
  }

  const print = () => {
    if (items.length > 1) {
      printA4Report({
        title: `Inventory Allocation ${escapeText(allocationCode(q))}`,
        metaItems: [
          { label: 'Allocation code', value: escapeText(allocationCode(q)) },
          { label: 'Staff member', value: escapeText(staff) },
          { label: 'Staff code', value: escapeText(staffCd) },
          { label: 'Date', value: escapeText(q.createdAt?.slice(0, 10) || '—') },
          { label: 'Status', value: escapeText(status) },
          { label: 'Remarks', value: escapeText(q.notes || q.remarks || '—') },
        ],
        columns: [
          { header: 'Product code', accessor: 'sku' },
          { header: 'Product name', accessor: 'name' },
          { header: 'Warehouse', accessor: 'warehouse' },
          { header: 'Available stock', accessor: 'avail', align: 'right' },
          { header: 'Given to staff', accessor: 'qty', align: 'right' },
          { header: 'Sold', accessor: 'sold', align: 'right' },
          { header: 'Remaining limit', accessor: 'rem', align: 'right' },
        ],
        data: items.map((item) => ({
          sku: escapeText(item.productSku || item.sku),
          name: escapeText(item.productName),
          warehouse: escapeText(item.warehouseName || (item.warehouseId ? '—' : 'All warehouses')),
          avail: `${Number(item.totalStockAvailable ?? item.currentStockInWarehouse ?? 0).toLocaleString()} ${item.productUnit || 'Units'}`,
          qty: item.allocatedQuantity != null ? `${Number(item.allocatedQuantity).toLocaleString()} ${item.productUnit || 'Units'}` : '—',
          sold: `${Number(item.soldQuantity || 0).toLocaleString()} ${item.productUnit || 'Units'}`,
          rem: `${Number(item.remainingQuantity ?? Math.max(0, Number(item.allocatedQuantity || 0) - Number(item.soldQuantity || 0))).toLocaleString()} ${item.productUnit || 'Units'}`,
        })),
      });
    } else {
      const unit = q.productUnit || 'Units', number = (value) => (value == null ? '—' : Number(value).toLocaleString()), stock = q.totalStockAvailable ?? q.currentStockInWarehouse;
      const remaining = q.remainingQuantity ?? (q.allocatedQuantity == null ? null : Math.max(0, Number(q.allocatedQuantity) - Number(q.soldQuantity || 0)));
      const measures = [['Total stock available', stock], ['Given to staff', q.allocatedQuantity], ['Sold', q.soldQuantity ?? 0], ['Remaining limit', remaining]];
      printA4Report({
        title: 'Inventory Allocation',
        columns: [{ header: 'Field', accessor: 'field' }, { header: 'Details', accessor: 'value' }],
        data: [
          ['Allocation code', allocationCode(q)],
          ['Product', q.productName],
          ['Product code', q.productSku],
          ['Staff member', staff],
          ['Staff code', q.userEmployeeCode],
          ['Warehouse', q.warehouseName],
          ['Date', q.createdAt?.slice(0, 10) || '—'],
          ['Status', status],
          ...measures.map(([label, value]) => [label, `${number(value)} ${unit}`]),
          ['Remarks', q.notes],
        ].map(([field, value]) => ({ field, value: escapeText(value) })),
      });
    }
  };

  return (
    <PurchaseInspectionModal
      type="Allocation"
      ariaLabel="Inventory allocation details"
      number={allocationCode(q)}
      status={status}
      rows={items}
      detailActions={actions}
      onPrint={print}
      onClose={onClose}
      tableToolbar
      tablePrint={true}
      tableSearchPlaceholder="Search product code, name or warehouse..."
      actionsPosition="bottom"
      detailsPosition="header"
      showHeaderClose
      closeLabel="Close"
      details={[
        { label: 'Staff member', value: staff, icon: UserRound },
        { label: 'Staff code', value: staffCd, icon: ShieldCheck },
        { label: 'Allocation date', value: q.createdAt?.slice(0, 10) || '—', icon: Calendar },
        { label: 'Remarks', value: q.notes || q.remarks, wide: true, icon: MessageSquare },
      ]}
      columns={[
        { label: 'Product code', value: (item) => item.productSku || item.sku || '—' },
        { label: 'Product name', value: (item) => item.productName || 'Product not selected' },
        { label: 'Warehouse', value: (item) => item.warehouseName || (item.warehouseId ? '—' : 'All warehouses') },
        {
          label: 'Available stock',
          numeric: true,
          value: (item) => {
            const stock = item.totalStockAvailable ?? item.currentStockInWarehouse;
            return stock != null ? `${Number(stock).toLocaleString()} ${item.productUnit || ''}` : '—';
          },
        },
        {
          label: 'Given to staff',
          numeric: true,
          value: (item) => (item.allocatedQuantity != null ? `${Number(item.allocatedQuantity).toLocaleString()} ${item.productUnit || ''}` : '—'),
        },
        {
          label: 'Sold',
          numeric: true,
          value: (item) => `${Number(item.soldQuantity || 0).toLocaleString()} ${item.productUnit || ''}`,
        },
        {
          label: 'Remaining limit',
          numeric: true,
          value: (item) => {
            const rem = item.remainingQuantity ?? (item.allocatedQuantity == null ? null : Math.max(0, Number(item.allocatedQuantity) - Number(item.soldQuantity || 0)));
            return rem != null ? `${Number(rem).toLocaleString()} ${item.productUnit || ''}` : '—';
          },
        },
      ]}
    />
  );
}
