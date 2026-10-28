import React from 'react';
import RecordDetailsModal from './RecordDetailsModal';
import { Edit2, RotateCw, Trash2 } from 'lucide-react';
import { printA4Report } from '../utils/printReport';
import './SupplierDetailsModal.css';

const escapeText = value => String(value ?? '—').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export default function VehicleDetailsModal({ vehicle = {}, onClose, onEdit, onChangeStatus, onDelete, canManage = true }) {
  const status = vehicle.status || 'AVAILABLE';
  const details = [
    ['Plate number', vehicle.vehicleNumber],
    ['Vehicle model', vehicle.model],
    ['Vehicle type', vehicle.vehicleType],
    ['Capacity (kg)', vehicle.capacityKg != null ? `${vehicle.capacityKg} kg` : '—'],
    ['Responsible staff', [vehicle.assignedStaffName, vehicle.assignedStaffEmployeeCode].filter(Boolean).join(' · ') || 'Unassigned'],
    ['Status', status.replaceAll('_', ' ')],
    ['Remarks / notes', vehicle.notes, true]
  ];

  const handlePrint = () => {
    printA4Report({
      title: 'Vehicle Details',
      metaItems: [
        { label: 'Plate Number', value: escapeText(vehicle.vehicleNumber) },
        { label: 'Model', value: escapeText(vehicle.model) },
        { label: 'Status', value: status.replaceAll('_', ' ') }
      ],
      columns: [
        { header: 'Field', accessor: 'field', width: '35%' },
        { header: 'Details', accessor: 'value' }
      ],
      data: details.map(([field, value]) => ({
        field,
        value: escapeText(value)
      }))
    });
  };

  const actions = canManage ? (
    <div className="purchase-inspection-detail-actions record-actions master-details-management supplier-card-actions" aria-label="Vehicle management actions">
      {onEdit && (
        <button type="button" className="btn btn-glass erp-button" aria-label="Edit vehicle" onClick={onEdit}>
          <Edit2 size={14} /> Edit Vehicle
        </button>
      )}
      {onChangeStatus && (
        <button type="button" className="btn btn-glass erp-button purchase-inspection-warning" aria-label="Change vehicle status" onClick={onChangeStatus}>
          <RotateCw size={14} /> Change Status
        </button>
      )}
      {onDelete && <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" aria-label="Delete vehicle" onClick={onDelete}><Trash2 size={14}/> Delete Vehicle</button>}
    </div>
  ) : null;

  return (
    <RecordDetailsModal
      label="Vehicle details"
      title={vehicle.vehicleNumber || `Vehicle draft #${vehicle.id}`}
      subtitle={`Vehicle · ${vehicle.model || '—'}`}
      status={status}
      details={details}
      onClose={onClose}
      onPrint={handlePrint}
      printTitle="Print Vehicle Details (A4)"
      className="supplier-inspection supplier-floating-card vehicle-inspection"
      actions={actions}
    />
  );
}
