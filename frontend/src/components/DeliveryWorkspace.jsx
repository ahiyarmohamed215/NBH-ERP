import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Truck, X, Search, CheckCircle, CheckSquare, Square, Zap, Plus, Check, Trash2 } from 'lucide-react';
import FilterSelect from './FilterSelect';
import { staffCode } from '../utils/staffCode';
import { dateError } from '../utils/purchasingValidation';
import '../views/GrnView.css';
import '../views/DeliveryTheme.css';
import './PurchaseProductSearch.css';

export default function DeliveryWorkspace({
  form,
  setForm,
  warehouses = [],
  routes = [],
  vehicles = [],
  employees = [],
  customers = [],
  invoices = [],
  busy = false,
  onClose,
  onSave
}) {
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState({});

  // Special invoice state (managed via the Add Special Invoice modal on the right)
  const [specialInvoiceIds, setSpecialInvoiceIds] = useState(
    () => new Set((form?.specialInvoiceIds || []).map(String))
  );
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialModalQuery, setSpecialModalQuery] = useState('');

  useEffect(() => {
    if (form?.specialInvoiceIds) {
      setSpecialInvoiceIds(new Set(form.specialInvoiceIds.map(String)));
    }
  }, [form?.specialInvoiceIds]);

  const change = (key, value) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: '' }));
  };

  const selectedRoute = useMemo(
    () => (routes || []).find(r => String(r.id) === String(form.routeId)),
    [routes, form.routeId]
  );

  const { routeCustomerIds, routeCustomerCodes } = useMemo(() => {
    if (!selectedRoute) return { routeCustomerIds: new Set(), routeCustomerCodes: new Set() };
    const idSet = new Set((selectedRoute.customerIds || []).map(String));
    const codeSet = new Set();
    (customers || []).forEach(c => {
      const isLinked = idSet.has(String(c.id)) || String(c.routeId || c.deliveryRouteId) === String(selectedRoute.id);
      if (isLinked) {
        idSet.add(String(c.id));
        if (c.customerCode || c.code) codeSet.add(String(c.customerCode || c.code).toLowerCase());
        if (c.name || c.customerName) codeSet.add(String(c.name || c.customerName).toLowerCase());
      }
    });
    return { routeCustomerIds: idSet, routeCustomerCodes: codeSet };
  }, [selectedRoute, customers]);

  // Only invoices of selected route + special fast-track invoices
  const availableInvoices = useMemo(() => {
    if (!form.routeId) {
      return (invoices || []).filter(inv => specialInvoiceIds.has(String(inv.id)));
    }
    return (invoices || []).filter(inv => {
      const isRouteInvoice =
        routeCustomerIds.has(String(inv.customerId)) ||
        (inv.customerCode && routeCustomerCodes.has(String(inv.customerCode).toLowerCase())) ||
        (inv.customerName && routeCustomerCodes.has(String(inv.customerName).toLowerCase())) ||
        (inv.routeId && String(inv.routeId) === String(form.routeId));
      const isSpecial = specialInvoiceIds.has(String(inv.id));
      return isRouteInvoice || isSpecial;
    });
  }, [invoices, form.routeId, routeCustomerIds, routeCustomerCodes, specialInvoiceIds]);

  const picked = useMemo(
    () => (invoices || []).filter(invoice => (form?.selectedInvoiceIds || []).some(id => String(id) === String(invoice.id))),
    [invoices, form?.selectedInvoiceIds]
  );

  const results = useMemo(
    () => availableInvoices.filter(invoice =>
      [invoice.invoiceNumber, invoice.customerName, invoice.customerCode, invoice.address, invoice.customerAddress]
        .some(value => String(value || '').toLowerCase().includes(query.toLowerCase()))
    ),
    [availableInvoices, query]
  );

  const specialModalList = useMemo(() => {
    const q = specialModalQuery.trim().toLowerCase();
    return (invoices || []).filter(inv => {
      if (!q) return true;
      return [inv.invoiceNumber, inv.customerName, inv.customerCode, inv.customerAddress, inv.address]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [invoices, specialModalQuery]);

  const handleAddSpecialInvoice = (inv) => {
    const idStr = String(inv.id);
    const nextSet = new Set([...specialInvoiceIds, idStr]);
    setSpecialInvoiceIds(nextSet);
    change('specialInvoiceIds', Array.from(nextSet).map(Number));
    if (!form.selectedInvoiceIds.some(id => String(id) === idStr)) {
      change('selectedInvoiceIds', [...form.selectedInvoiceIds, inv.id]);
    }
  };

  const handleRemoveSpecialInvoice = (id) => {
    const idStr = String(id);
    const nextSet = new Set(specialInvoiceIds);
    nextSet.delete(idStr);
    setSpecialInvoiceIds(nextSet);
    change('specialInvoiceIds', Array.from(nextSet).map(Number));
  };

  const totalSelectedAmount = useMemo(
    () => picked.reduce((sum, invoice) => sum + Number(invoice.netTotal || 0), 0),
    [picked]
  );

  const toggleInvoice = (id) => {
    const isSelected = form.selectedInvoiceIds.some(existingId => String(existingId) === String(id));
    change(
      'selectedInvoiceIds',
      isSelected
        ? form.selectedInvoiceIds.filter(existingId => String(existingId) !== String(id))
        : [...form.selectedInvoiceIds, id]
    );
  };

  const find = (rows, id) => rows.find(row => String(row.id) === String(id));
  const person = id => {
    const row = find(employees, id);
    return row?.fullName || row?.username || '—';
  };

  const submit = event => {
    event.preventDefault();
    if (busy) return;
    const next = {};
    for (const key of ['routeId', 'vehicleId', 'driverId', 'assistantStaffId']) {
      if (!form[key]) next[key] = 'Select an option.';
    }
    if (form.driverId && String(form.driverId) === String(form.assistantStaffId)) {
      next.assistantStaffId = 'Choose a different staff member.';
    }
    const date = dateError(form.scheduledDate, 'Scheduled date');
    if (date) next.scheduledDate = date;
    if (!form.selectedInvoiceIds.length) {
      next.invoices = 'Select at least one invoice.';
    }
    setErrors(next);
    if (!Object.keys(next).length) onSave(event, { isDraft: false, specialInvoiceIds: Array.from(specialInvoiceIds).map(Number) });
  };

  const submitDraft = event => {
    if (event) event.preventDefault();
    if (busy) return;
    const hasAnyField = Boolean(
      form.routeId ||
      form.vehicleId ||
      form.driverId ||
      form.assistantStaffId ||
      form.scheduledDate ||
      (form.notes && form.notes.trim()) ||
      form.departureTime ||
      (form.selectedInvoiceIds && form.selectedInvoiceIds.length > 0) ||
      specialInvoiceIds.size > 0
    );
    if (!hasAnyField) {
      setErrors({ notes: 'Please fill at least one field to save a delivery draft.' });
      return;
    }
    setErrors({});
    onSave(event, { isDraft: true, specialInvoiceIds: Array.from(specialInvoiceIds).map(Number) });
  };

  return (
    <form
      className="grn-page grn-form delivery-workspace delivery-grn-workspace"
      aria-label="New delivery"
      noValidate
      onSubmit={submit}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}
    >
      {/* GRN-Style Workstation Header */}
      <div
        className="delivery-workspace-header"
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Truck size={20} />
          </div>
          <div>
            <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700 }}>
              New Delivery
            </h2>
            <p style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', margin: '1px 0 0 0' }}>
              Dispatch workstation — assign route, vehicle, delivery crew & load pending invoices
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close delivery editor"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* GRN-Style Workstation Body */}
      <div className="grn-form-body delivery-form-body" style={{ padding: '12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="grn-form-content" style={{ display: 'flex', flex: 1, minHeight: 0, gap: '12px' }}>
          <div
            className="grn-workspace delivery-workspace-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(330px, 0.9fr) minmax(0, 1.4fr)',
              gridTemplateRows: 'minmax(0, 1fr) auto',
              gap: '12px',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Left Workstation Column: Configuration & Assignment Card */}
            <div
              className="grn-entry delivery-entry"
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ fontSize: 'var(--erp-text-body)', fontWeight: 700, color: '#1e293b' }}>
                  Trip Assignment
                </span>
              </div>

              {/* Line 1: Delivery route and vehicle in one line */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Delivery route *
                  <FilterSelect
                    variant="field"
                    name="routeId"
                    aria-label="Delivery route"
                    value={form.routeId}
                    disabled={busy}
                    onChange={event => change('routeId', event.target.value)}
                  >
                    <option value="">Select delivery route</option>
                    {routes.map(row => <option key={row.id} value={row.id}>{row.routeName}</option>)}
                  </FilterSelect>
                  {errors.routeId && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.routeId}</small>}
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Vehicle *
                  <FilterSelect
                    variant="field"
                    name="vehicleId"
                    aria-label="Vehicle"
                    value={form.vehicleId}
                    disabled={busy}
                    onChange={event => change('vehicleId', event.target.value)}
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map(row => <option key={row.id} value={row.id}>{`${row.vehicleNumber} · ${row.model || row.status}`}</option>)}
                  </FilterSelect>
                  {errors.vehicleId && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.vehicleId}</small>}
                </label>
              </div>

              {/* Line 2: Scheduled date and planned departure in one line */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Scheduled date *
                  <input
                    className="erp-field"
                    type="date"
                    name="scheduledDate"
                    aria-label="Scheduled date"
                    value={form.scheduledDate}
                    disabled={busy}
                    onChange={event => change('scheduledDate', event.target.value)}
                    style={{ height: '36px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {errors.scheduledDate && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.scheduledDate}</small>}
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Planned departure
                  <input
                    className="erp-field"
                    type="datetime-local"
                    name="departureTime"
                    aria-label="Planned departure"
                    value={form.departureTime}
                    disabled={busy}
                    onChange={event => change('departureTime', event.target.value)}
                    style={{ height: '36px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {errors.departureTime && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.departureTime}</small>}
                </label>
              </div>

              {/* Line 3: Driver and delivery assistant in one line */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Driver *
                  <FilterSelect
                    variant="field"
                    name="driverId"
                    aria-label="Driver"
                    value={form.driverId}
                    disabled={busy}
                    onChange={event => change('driverId', event.target.value)}
                  >
                    <option value="">Select driver</option>
                    {employees.map(row => <option key={row.id} value={row.id}>{`${row.fullName || row.username} · ${staffCode(row)}`}</option>)}
                  </FilterSelect>
                  {errors.driverId && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.driverId}</small>}
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                  Delivery assistant *
                  <FilterSelect
                    variant="field"
                    name="assistantStaffId"
                    aria-label="Delivery assistant"
                    value={form.assistantStaffId}
                    disabled={busy}
                    onChange={event => change('assistantStaffId', event.target.value)}
                  >
                    <option value="">Select assistant</option>
                    {employees.map(row => <option key={row.id} value={row.id}>{`${row.fullName || row.username} · ${staffCode(row)}`}</option>)}
                  </FilterSelect>
                  {errors.assistantStaffId && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)' }}>{errors.assistantStaffId}</small>}
                </label>
              </div>

              {/* Line 4: Remarks and notes in one line */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#475569' }}>
                Remarks / notes
                <textarea
                  className="erp-field"
                  aria-label="Delivery notes"
                  name="notes"
                  maxLength={5000}
                  rows={3}
                  placeholder="Delivery instructions, route sequence notes, or gate passes..."
                  value={form.notes}
                  disabled={busy}
                  onChange={event => change('notes', event.target.value)}
                  style={{ height: '72px', minHeight: '56px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </label>
            </div>

            {/* Right Workstation Column: Invoices to Load Table */}
            <div
              className="grn-items delivery-items"
              style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
            >
              {/* Table Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: 'var(--erp-text-body)', fontWeight: 800, color: '#1e293b' }}>
                  Invoices to load ({picked.length} selected / {availableInvoices.length} available)
                </span>
                <div aria-label="Delivery summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: 'var(--erp-text-small)',
                      color: '#475569',
                      fontWeight: 600,
                      background: '#f1f5f9',
                      padding: '3px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    Loaded Value: <strong style={{ color: '#0284c7' }}>LKR {totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              </div>

              {/* Invoice Toolbar: Search & Select All */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div className="delivery-search" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <Search size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: '#94a3b8' }} />
                  <input
                    className="erp-field"
                    type="search"
                    aria-label="Search delivery invoices"
                    placeholder="Search invoice number, customer name, code or address..."
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 12px 0 32px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <button
                  type="button"
                  className="erp-button erp-button-special"
                  aria-label="Add special invoice"
                  onClick={() => setShowSpecialModal(true)}
                  style={{
                    height: '36px',
                    padding: '0 13px',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                    background: '#fffbeb',
                    color: '#92400e',
                    fontSize: 'var(--erp-text-small)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#fef3c7';
                    e.currentTarget.style.borderColor = '#f59e0b';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fffbeb';
                    e.currentTarget.style.borderColor = '#fde68a';
                  }}
                  title="Add urgent or off-route customer invoices as special deliveries"
                >
                  <Plus size={15} strokeWidth={2.2} />
                  <span>Add Special Invoice</span>
                  {specialInvoiceIds.size > 0 && (
                    <span
                      style={{
                        background: '#f59e0b',
                        color: '#ffffff',
                        borderRadius: '9999px',
                        padding: '1px 6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        marginLeft: '2px',
                      }}
                    >
                      {specialInvoiceIds.size}
                    </span>
                  )}
                </button>
              </div>

              {/* Invoices Table */}
              <div className="grn-table-scroll erp-table-scroll erp-table-frame" style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
                <table className="glass-table erp-table" style={{ margin: 0, minWidth: '600px', width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                    <tr>
                      <th className="erp-table-heading" style={{ width: '40px', textAlign: 'center', padding: '8px 10px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LOAD</span>
                      </th>
                      <th className="erp-table-heading">INVOICE NUMBER</th>
                      <th className="erp-table-heading">CUSTOMER</th>
                      <th className="erp-table-heading">DESTINATION / ADDRESS</th>
                      <th className="erp-table-heading grn-number" style={{ textAlign: 'right', paddingRight: '16px' }}>NET TOTAL (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!results.length ? (
                      <tr>
                        <td colSpan="5" className="grn-empty erp-table-cell" style={{ textAlign: 'center', padding: '28px 12px', color: '#64748b' }}>
                          {!form.routeId && specialInvoiceIds.size === 0
                            ? 'Select a delivery route to view customer invoices to load, or add special fast-track invoices on the left.'
                            : 'No matching customer invoices ready for delivery.'}
                        </td>
                      </tr>
                    ) : (
                      results.map(invoice => {
                        const isSelected = form.selectedInvoiceIds.some(id => String(id) === String(invoice.id));
                        return (
                          <tr
                            key={invoice.id}
                            className={isSelected ? 'grn-editing-row' : ''}
                            onClick={() => toggleInvoice(invoice.id)}
                            style={{
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                              transition: 'background-color 0.1s ease',
                            }}
                          >
                            <td className="erp-table-cell" style={{ textAlign: 'center', padding: '8px 10px' }}>
                              <input
                                type="checkbox"
                                aria-label={`Load ${invoice.invoiceNumber}`}
                                checked={isSelected}
                                onChange={event => {
                                  event.stopPropagation();
                                  toggleInvoice(invoice.id);
                                }}
                                style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                              />
                            </td>
                            <td className="erp-table-cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong className="grn-product-code" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                                  {invoice.invoiceNumber}
                                </strong>
                                {specialInvoiceIds.has(String(invoice.id)) && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      border: '1px solid #fde68a',
                                      borderRadius: '9999px',
                                      padding: '1px 8px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Marked as Special Invoice"
                                  >
                                    ⚡ Special Invoice · Fast-Track
                                    <button
                                      type="button"
                                      aria-label={`Remove special mark for ${invoice.invoiceNumber}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSpecialInvoice(invoice.id);
                                      }}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#92400e',
                                        cursor: 'pointer',
                                        padding: 0,
                                        marginLeft: '2px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="erp-table-cell">
                              <div>
                                <strong style={{ color: '#0f172a' }}>{invoice.customerName || '—'}</strong>
                                {invoice.customerCode && (
                                  <span style={{ display: 'block', fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                                    {invoice.customerCode}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="erp-table-cell" style={{ color: '#475569', fontSize: 'var(--erp-text-small)' }}>
                              {invoice.address || invoice.customerAddress || '—'}
                            </td>
                            <td className="grn-number erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', paddingRight: '16px' }}>
                              LKR {Number(invoice.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {errors.invoices && <small style={{ color: '#e11d48', fontSize: 'var(--erp-text-caption)', marginTop: '4px' }}>{errors.invoices}</small>}

              {/* Financial & Loaded Metrics Card (GRN style) */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: 'var(--erp-text-small)' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Selected Invoices: </span>
                    <strong style={{ color: '#0f172a' }}>{picked.length}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Destinations: </span>
                    <strong style={{ color: '#0f172a' }}>{new Set(picked.map(i => i.customerName || i.customerId)).size}</strong>
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 'var(--erp-text-small)' }}>Total Cargo Value: </span>
                  <strong style={{ fontSize: 'var(--erp-text-body)', fontWeight: 800, color: '#0284c7' }}>
                    LKR {totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Bottom Pinned Action Bar */}
            <div
              className="grn-form-actions"
              style={{
                gridColumn: '1 / -1',
                padding: '10px 16px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '12px',
                borderRadius: '0 0 10px 10px',
              }}
            >
              <div style={{ fontSize: 'var(--erp-text-small)', color: '#475569' }}>
                <span><strong>{picked.length}</strong> invoice{picked.length === 1 ? '' : 's'} selected · Total: <strong style={{ color: '#0284c7' }}>LKR {totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="erp-button"
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={submitDraft}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: 'var(--erp-text-button)',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 'var(--erp-text-button)',
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={16} />
                  {busy ? 'Saving...' : 'Create Delivery'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Special Invoices Modal */}
      {showSpecialModal && (
        <div
          className="modal-backdrop delivery-dialog"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowSpecialModal(false)}
        >
          <div
            className="glass-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add Special Invoices Modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'min(620px, 86vh)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#fffbeb',
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ Add Special Invoice
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--erp-text-caption)', color: '#b45309' }}>
                  Fast-track urgent customer invoices or add deliveries outside the assigned route.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecialModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#92400e',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close special invoice modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#94a3b8' }} />
                <input
                  className="erp-field"
                  type="search"
                  aria-label="Search special invoices"
                  placeholder="Search invoice number, customer name, code or address..."
                  value={specialModalQuery}
                  onChange={e => setSpecialModalQuery(e.target.value)}
                  autoFocus
                  style={{ width: '100%', height: '36px', padding: '0 12px 0 32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                />
              </div>
            </div>

            {/* List of Pending Invoices */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 20px' }}>
              {specialModalList.length === 0 ? (
                <div style={{ padding: '36px 12px', textAlign: 'center', color: '#64748b' }}>
                  {specialModalQuery ? `No pending invoices matching "${specialModalQuery}".` : 'No pending invoices available.'}
                </div>
              ) : (
                specialModalList.map(inv => {
                  const isSpecial = specialInvoiceIds.has(String(inv.id));
                  return (
                    <div
                      key={inv.id}
                      className="special-modal-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isSpecial ? '#fde68a' : '#e2e8f0',
                        backgroundColor: isSpecial ? '#fffbeb' : '#ffffff',
                        marginBottom: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: 'var(--erp-text-body)' }}>
                            {inv.invoiceNumber}
                          </strong>
                          {isSpecial && (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                borderRadius: '9999px',
                                padding: '1px 7px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              ⚡ Special Invoice
                            </span>
                          )}
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{inv.customerName}</span>
                          {inv.customerCode && <span style={{ color: '#64748b', fontSize: 'var(--erp-text-caption)' }}>({inv.customerCode})</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', fontSize: 'var(--erp-text-caption)', color: '#475569' }}>
                          <span>📍 {inv.customerAddress || inv.address || 'No address specified'}</span>
                          <span>•</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            LKR {Number(inv.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div>
                        {isSpecial ? (
                          <button
                            type="button"
                            className="erp-button"
                            aria-label={`Remove special invoice ${inv.invoiceNumber}`}
                            onClick={() => handleRemoveSpecialInvoice(inv.id)}
                            style={{
                              height: '32px',
                              padding: '0 12px',
                              borderRadius: '6px',
                              border: '1px solid #fca5a5',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: 'var(--erp-text-caption)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Trash2 size={13} />
                            Remove Special
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="erp-button erp-button-special"
                            aria-label={`Add special invoice ${inv.invoiceNumber}`}
                            onClick={() => handleAddSpecialInvoice(inv)}
                            style={{
                              height: '32px',
                              padding: '0 12px',
                              borderRadius: '6px',
                              border: '1px solid #fde68a',
                              background: '#fffbeb',
                              color: '#92400e',
                              fontSize: 'var(--erp-text-caption)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Plus size={13} strokeWidth={2.2} />
                            Add as Special
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                <strong style={{ color: '#92400e' }}>{specialInvoiceIds.size}</strong> special invoice{specialInvoiceIds.size === 1 ? '' : 's'} added to this delivery
              </span>
              <button
                type="button"
                className="erp-button erp-button-primary"
                onClick={() => setShowSpecialModal(false)}
                style={{
                  padding: '6px 18px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
