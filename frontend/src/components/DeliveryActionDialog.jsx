import React from 'react';
import { Truck, X, CheckCircle, AlertTriangle, CalendarClock } from 'lucide-react';
import { numberError } from '../utils/purchasingValidation';
import './SupplierStatusDialog.css';

export default function DeliveryActionDialog({ mode, trip, form, setForm, busy, onClose, onConfirm }) {
  const cancel = mode === 'cancel';
  const complete = mode === 'complete';
  const reschedule = mode === 'reschedule';
  const dispatch = !cancel && !complete && !reschedule;

  const title = reschedule
    ? 'Reschedule delivery'
    : cancel
    ? 'Cancel delivery'
    : complete
    ? 'Complete delivery'
    : 'Dispatch delivery';

  const date = complete ? 'returnTime' : 'departureTime';
  const odo = complete ? 'endOdometer' : 'startOdometer';
  const numeric = complete && form[odo] ? numberError(form[odo], 'Odometer', { decimals: 1 }) : '';

  const invalid = reschedule
    ? !form.newScheduledDate || !form.reason?.trim()
    : cancel
    ? !form.cancellationReason?.trim()
    : complete
    ? !form[date] || Boolean(numeric) || (form[odo] && Number(form[odo]) < Number(trip.startOdometer || 0))
    : !form[date];

  const targetStatus = reschedule
    ? 'RESCHEDULED'
    : cancel
    ? 'CANCELLED'
    : complete
    ? 'DELIVERED'
    : 'IN TRANSIT';

  const description = reschedule
    ? 'Set a new scheduled date and enter the reason why the trip could not depart.'
    : cancel
    ? 'Assigned invoices will be restored to pending. Enter a cancellation reason.'
    : complete
    ? 'Record the return time and final odometer reading.'
    : 'Record the departure time and any remarks.';

  const dialogToneClass = reschedule
    ? 'supplier-status-reschedule'
    : cancel
    ? 'supplier-status-deactivate'
    : complete
    ? 'supplier-status-activate'
    : 'purchasing-status-neutral';

  return (
    <div className="modal-backdrop purchasing-no-shadows" style={{ padding: 12, zIndex: 1300 }}>
      <div
        className={`glass-modal supplier-status-dialog ${dialogToneClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div className="purchasing-status-symbol">
            {reschedule ? (
              <CalendarClock size={19} />
            ) : cancel ? (
              <AlertTriangle size={19} />
            ) : complete ? (
              <CheckCircle size={19} />
            ) : (
              <Truck size={19} />
            )}
          </div>
          <h3>{title}</h3>
          <button type="button" aria-label="Close delivery status change" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="purchasing-status-body">
          <div className="supplier-status-summary">
            <div className="purchasing-status-record">
              <small>Delivery number</small>
              <strong>{trip.deliveryNumber}</strong>
            </div>
            <div className="purchasing-status-transition">
              <span>{trip.status.replaceAll('_', ' ')} → {targetStatus}</span>
            </div>
          </div>

          <p className="purchasing-status-description">{description}</p>

          {/* Reschedule Date Field */}
          {reschedule && (
            <div className="delivery-action-fields">
              <label>
                New scheduled date *
                <input
                  className="erp-field"
                  type="date"
                  aria-label="New scheduled date"
                  value={form.newScheduledDate || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, newScheduledDate: event.target.value })}
                />
              </label>
            </div>
          )}

          {/* Dispatch Date Field (no odometer) */}
          {dispatch && (
            <div className="delivery-action-fields">
              <label>
                Departure time *
                <input
                  className="erp-field"
                  type="datetime-local"
                  aria-label="Departure time"
                  value={form[date] || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, [date]: event.target.value })}
                />
              </label>
            </div>
          )}

          {/* Complete Fields (Return time + optional Odometer) */}
          {complete && (
            <div className="delivery-action-fields">
              <label>
                Return time *
                <input
                  className="erp-field"
                  type="datetime-local"
                  aria-label="Return time"
                  value={form[date] || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, [date]: event.target.value })}
                />
              </label>
              <label>
                Odometer (km)
                <input
                  className="erp-field"
                  type="text"
                  inputMode="decimal"
                  aria-label="Odometer"
                  value={form[odo] || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, [odo]: event.target.value })}
                />
                {numeric && <small className="allocation-field-error">{numeric}</small>}
                {form[odo] && Number(form[odo]) < Number(trip.startOdometer || 0) && (
                  <small className="allocation-field-error">Must be at least {trip.startOdometer} km.</small>
                )}
              </label>
            </div>
          )}

          {/* Reschedule Reason and Notes */}
          {reschedule && (
            <>
              <label className="purchasing-status-reason">
                <span>Reason for rescheduling *</span>
                <textarea
                  className="erp-field"
                  aria-label="Reschedule reason"
                  placeholder="Explain why the driver or assistant could not go..."
                  maxLength={1000}
                  rows={3}
                  value={form.reason || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                />
              </label>
              <label className="purchasing-status-reason" style={{ marginTop: 8 }}>
                <span>Remarks / notes</span>
                <textarea
                  className="erp-field"
                  aria-label="Reschedule remarks"
                  placeholder="Additional remarks (optional)..."
                  maxLength={1000}
                  rows={2}
                  value={form.notes || ''}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </>
          )}

          {/* Cancellation Reason */}
          {cancel && (
            <label className="purchasing-status-reason">
              <span>Cancellation reason *</span>
              <textarea
                className="erp-field"
                aria-label="Cancellation reason"
                placeholder="Enter cancellation reason..."
                maxLength={1000}
                rows={3}
                value={form.cancellationReason || ''}
                disabled={busy}
                onChange={(event) => setForm({ ...form, cancellationReason: event.target.value })}
              />
            </label>
          )}

          {/* Dispatch or Complete Notes */}
          {(dispatch || complete) && (
            <label className="purchasing-status-reason">
              <span>Remarks / notes</span>
              <textarea
                className="erp-field"
                aria-label="Delivery status notes"
                placeholder={dispatch ? 'Departure notes, instructions...' : 'Trip completion remarks...'}
                maxLength={1000}
                rows={3}
                value={form.notes || ''}
                disabled={busy}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          )}
        </div>

        <footer>
          <button type="button" className="btn btn-glass erp-button" disabled={busy} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="supplier-status-confirm"
            disabled={busy || invalid}
            onClick={onConfirm}
          >
            {busy
              ? 'Updating...'
              : reschedule
              ? 'Reschedule Delivery'
              : cancel
              ? 'Confirm Cancellation'
              : complete
              ? 'Complete Delivery'
              : 'Dispatch Delivery'}
          </button>
        </footer>
      </div>
    </div>
  );
}
