import React, { useEffect, useRef, useState } from 'react';
import { X, Save, LoaderCircle, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import './SupplierEditorModal.css';
import './AllocationWorkspace.css';

export default function CustomerEditorModal({
  form,
  setForm,
  editing,
  saving,
  canEditCustomer = true,
  onClose,
  onSubmit,
}) {
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    formRef.current?.elements.namedItem('name')?.focus();
    return () => previous?.focus();
  }, []);

  const isDraft = editing?.draft || form.draft;

  const validate = (formData, forDraft = false) => {
    const nextErrors = {};
    if (!forDraft) {
      if (!formData.name || formData.name.trim().length < 2) {
        nextErrors.name = 'Customer name must be at least 2 characters';
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        nextErrors.email = 'Invalid email address format';
      }
    } else {
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        nextErrors.email = 'Invalid email address format';
      }
    }
    return nextErrors;
  };

  const change = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      setErrors((prevErr) => ({ ...prevErr, [field]: validate(next, isDraft)[field] || '' }));
      return next;
    });
  };

  const blur = (field) => {
    setErrors((prevErr) => ({ ...prevErr, [field]: validate(form, isDraft)[field] || '' }));
  };

  const hasInput = ['name', 'contactPerson', 'phone', 'email', 'address', 'code'].some((field) =>
    String(form[field] || '').trim()
  );
  const canDraft = hasInput && !Object.keys(validate(form, true)).length;

  const submit = (event, draft = isDraft) => {
    if (event) event.preventDefault();
    if (saving) return;
    const next = validate(form, draft);
    setErrors(next);
    if (draft && !hasInput) return;
    if (Object.keys(next).length) {
      formRef.current?.elements.namedItem(Object.keys(next)[0])?.focus();
      return;
    }
    onSubmit(event, draft);
  };

  const displayCode = editing?.code || editing?.customerCode || form.code || 'Generated automatically';

  return (
    <div className="supplier-workspace-shell purchasing-no-shadows">
      <div
        className="allocation-workspace supplier-editor supplier-workspace"
        aria-labelledby="customer-editor-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented && !saving) {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="allocation-workspace-header">
          <div className="allocation-workspace-title">
            <span className="allocation-title-icon">
              <Users size={23} />
            </span>
            <div>
              <h2 className="erp-dialog-title" id="customer-editor-title">
                {editing ? 'Edit Customer' : 'New Customer'}
              </h2>
              {editing && <p>{displayCode}</p>}
            </div>
          </div>
          <button
            type="button"
            className="purchase-inspection-close allocation-header-close"
            aria-label="Close customer editor"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form ref={formRef} noValidate onSubmit={(e) => submit(e, false)} aria-busy={saving}>
          <div className="allocation-workspace-body">
            <fieldset disabled={saving} className="supplier-editor-fields">
              <label className="supplier-editor-field" htmlFor="customer-name">
                <span>
                  Customer Name {!isDraft && <span className="supplier-required">*</span>}
                </span>
                <input
                  className="erp-field"
                  id="customer-name"
                  name="name"
                  aria-label="Customer name"
                  value={form.name || ''}
                  aria-invalid={Boolean(errors.name)}
                  onChange={(e) => change('name', e.target.value)}
                  onBlur={() => blur('name')}
                  placeholder="e.g. Apex Supermarket"
                />
                {errors.name && <small className="supplier-field-error">{errors.name}</small>}
              </label>

              <label className="supplier-editor-field" htmlFor="customer-code">
                <span>Customer Code</span>
                <input
                  className="erp-field"
                  id="customer-code"
                  name="code"
                  aria-label="Customer code"
                  value={form.code || ''}
                  onChange={(e) => change('code', e.target.value.toUpperCase())}
                  placeholder="Auto (e.g. CUST-001)"
                  disabled={editing && !editing?.draft}
                  style={editing && !editing?.draft ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                />
              </label>

              <label className="supplier-editor-field" htmlFor="customer-contactPerson">
                <span>Contact Person</span>
                <input
                  className="erp-field"
                  id="customer-contactPerson"
                  name="contactPerson"
                  aria-label="Contact person"
                  value={form.contactPerson || ''}
                  onChange={(e) => change('contactPerson', e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </label>

              <label className="supplier-editor-field" htmlFor="customer-phone">
                <span>Contact Number</span>
                <input
                  className="erp-field"
                  type="tel"
                  id="customer-phone"
                  name="phone"
                  aria-label="Contact number"
                  value={form.phone || ''}
                  onChange={(e) => change('phone', e.target.value)}
                  placeholder="+94 77 123 4567"
                />
              </label>

              <label className="supplier-editor-field" htmlFor="customer-email">
                <span>Email Address</span>
                <input
                  className="erp-field"
                  type="email"
                  id="customer-email"
                  name="email"
                  aria-label="Email address"
                  value={form.email || ''}
                  aria-invalid={Boolean(errors.email)}
                  onChange={(e) => change('email', e.target.value)}
                  onBlur={() => blur('email')}
                  placeholder="info@example.com"
                />
                {errors.email && <small className="supplier-field-error">{errors.email}</small>}
              </label>

              <label className="supplier-editor-field" htmlFor="customer-creditLimit">
                <span>Approved Credit Limit (LKR)</span>
                <input
                  className="erp-field"
                  type="number"
                  step="0.01"
                  min="0"
                  id="customer-creditLimit"
                  name="creditLimit"
                  aria-label="Approved credit limit"
                  value={form.creditLimit ?? '0'}
                  onChange={(e) => change('creditLimit', e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <label className="supplier-editor-field supplier-editor-wide" htmlFor="customer-address">
                <span>Physical Address</span>
                <textarea
                  className="erp-field"
                  id="customer-address"
                  name="address"
                  aria-label="Physical address"
                  value={form.address || ''}
                  rows={3}
                  onChange={(e) => change('address', e.target.value)}
                  placeholder="Street, town, postal code and district"
                />
              </label>
            </fieldset>

            <aside className="allocation-receipt allocation-inline-review" aria-label="Customer summary">
              <div className="allocation-receipt-heading">
                <span className="allocation-receipt-symbol">
                  <Users size={23} />
                </span>
                <h3>Customer summary</h3>
                <p>Check the details before saving.</p>
              </div>

              <div className="allocation-receipt-section">
                <h4>Customer Profile</h4>
                <strong>{form.name || '—'}</strong>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge
                        status={
                          editing?.draft || (!editing && isDraft)
                            ? 'DRAFT'
                            : editing
                            ? (editing.isActive ?? editing.active) !== false
                              ? 'ACTIVE'
                              : 'INACTIVE'
                            : 'ACTIVE'
                        }
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Customer code</dt>
                    <dd>{displayCode}</dd>
                  </div>
                </dl>
              </div>

              <div className="allocation-receipt-section">
                <h4>Contact Details</h4>
                <dl>
                  {[
                    ['Contact person', form.contactPerson],
                    ['Phone', form.phone],
                    ['Email', form.email],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="allocation-receipt-section">
                <h4>Financial Credit</h4>
                <dl>
                  <div>
                    <dt>Credit limit</dt>
                    <dd>
                      {form.creditLimit
                        ? `LKR ${Number(form.creditLimit || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : 'LKR 0.00'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="allocation-receipt-notes">
                <h4>Physical Address</h4>
                <p>{form.address || 'No physical address entered'}</p>
              </div>
            </aside>
          </div>

          <footer className="allocation-workspace-actions">
            <span>
              {isDraft
                ? 'Complete the details, then activate from View.'
                : 'Customer code is generated automatically if omitted.'}
            </span>
            <div>
              <button
                type="button"
                className="allocation-secondary"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </button>
              {(!editing || editing.draft) && (
                <button
                  type="button"
                  className="allocation-secondary"
                  disabled={saving || !canDraft}
                  onClick={(event) => submit(event, true)}
                >
                  Save Draft
                </button>
              )}
              <button
                type="submit"
                className="allocation-primary"
                disabled={saving || (editing && !canEditCustomer) || (isDraft && !canDraft)}
              >
                {saving ? (
                  <LoaderCircle size={15} className="supplier-editor-spinner" />
                ) : (
                  <Save size={15} />
                )}
                {saving
                  ? 'Saving...'
                  : editing?.draft
                  ? 'Activate Customer'
                  : editing
                  ? 'Update Customer'
                  : 'Save Customer'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
