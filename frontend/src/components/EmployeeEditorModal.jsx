import React, { useEffect, useRef, useState } from 'react';
import { X, Save, LoaderCircle, UserCheck, ShieldCheck } from 'lucide-react';
import { staffCode } from '../utils/staffCode';
import StatusBadge from './StatusBadge';
import './SupplierEditorModal.css';
import './AllocationWorkspace.css';

export default function EmployeeEditorModal({
  form,
  setForm,
  editing,
  selectedEmployee,
  saving,
  roles = [],
  onClose,
  onSubmit,
}) {
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    formRef.current?.elements.namedItem('fullName')?.focus();
    return () => previous?.focus();
  }, []);

  const isDraft = editing && form.status === 'DRAFT';

  const formatRoleName = (rName) => {
    if (!rName) return 'Staff';
    if (typeof rName !== 'string') rName = rName?.name || '';
    if (rName.startsWith('ROLE_')) {
      const clean = rName.replace('ROLE_', '');
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return rName;
  };

  const validate = (formData, forDraft = false) => {
    const nextErrors = {};
    if (!forDraft) {
      if (!formData.fullName || formData.fullName.trim().length < 2) {
        nextErrors.fullName = 'Full name must be at least 2 characters';
      }
      if (!editing && (!formData.username || formData.username.trim().length < 3)) {
        nextErrors.username = 'Username must be at least 3 characters';
      }
      if (!editing && (!formData.password || formData.password.length < 6)) {
        nextErrors.password = 'Password must be at least 6 characters';
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        nextErrors.email = 'Invalid email address format';
      }
      if (!formData.roles || formData.roles.length === 0) {
        nextErrors.roles = 'At least one role must be selected';
      }
    } else {
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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

  const toggleRole = (roleName) => {
    setForm((prev) => {
      const current = prev.roles || [];
      const exists = current.includes(roleName);
      const nextRoles = exists ? current.filter((r) => r !== roleName) : [...current, roleName];
      const next = { ...prev, roles: nextRoles };
      setErrors((prevErr) => ({ ...prevErr, roles: validate(next, isDraft).roles || '' }));
      return next;
    });
  };

  const hasInput = ['fullName', 'username', 'email', 'phone'].some((field) =>
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
    onSubmit(event, draft ? 'DRAFT' : undefined);
  };

  const displayCode = editing ? staffCode(selectedEmployee) : form.employeeCode || 'Generated automatically';

  return (
    <div className="supplier-workspace-shell purchasing-no-shadows">
      <div
        className="allocation-workspace supplier-editor supplier-workspace"
        aria-labelledby="employee-editor-title"
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
              <UserCheck size={23} />
            </span>
            <div>
              <h2 className="erp-dialog-title" id="employee-editor-title">
                {editing ? 'Edit Employee' : 'New Employee'}
              </h2>
              {editing && <p>{displayCode}</p>}
            </div>
          </div>
          <button
            type="button"
            className="purchase-inspection-close allocation-header-close"
            aria-label="Close employee editor"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form ref={formRef} noValidate onSubmit={(e) => submit(e, false)} aria-busy={saving}>
          <div className="allocation-workspace-body">
            <fieldset disabled={saving} className="supplier-editor-fields">
              <label className="supplier-editor-field" htmlFor="employee-fullName">
                <span>
                  Full Name {!isDraft && <span className="supplier-required">*</span>}
                </span>
                <input
                  className="erp-field"
                  id="employee-fullName"
                  name="fullName"
                  value={form.fullName || ''}
                  aria-invalid={Boolean(errors.fullName)}
                  onChange={(e) => change('fullName', e.target.value)}
                  onBlur={() => blur('fullName')}
                  placeholder="Employee full name"
                />
                {errors.fullName && <small className="supplier-field-error">{errors.fullName}</small>}
              </label>

              <label className="supplier-editor-field" htmlFor="employee-username">
                <span>
                  Username {!isDraft && !editing && <span className="supplier-required">*</span>}
                </span>
                <input
                  className="erp-field"
                  id="employee-username"
                  name="username"
                  value={form.username || ''}
                  disabled={editing}
                  aria-invalid={Boolean(errors.username)}
                  onChange={(e) => change('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  onBlur={() => blur('username')}
                  placeholder="Unique username (e.g. john.doe)"
                  style={editing ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                />
                {errors.username && <small className="supplier-field-error">{errors.username}</small>}
              </label>

              <label className="supplier-editor-field" htmlFor="employee-code">
                <span>Staff Code</span>
                <input
                  className="erp-field"
                  id="employee-code"
                  name="employeeCode"
                  aria-label="Staff code"
                  value={displayCode}
                  readOnly={true}
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#0284c7', fontWeight: 600 }}
                />
              </label>

              <label className="supplier-editor-field" htmlFor="employee-email">
                <span>
                  Email Address {!isDraft && <span className="supplier-required">*</span>}
                </span>
                <input
                  className="erp-field"
                  type="email"
                  id="employee-email"
                  name="email"
                  value={form.email || ''}
                  aria-invalid={Boolean(errors.email)}
                  onChange={(e) => change('email', e.target.value)}
                  onBlur={() => blur('email')}
                  placeholder="name@example.com"
                />
                {errors.email && <small className="supplier-field-error">{errors.email}</small>}
              </label>

              <label className="supplier-editor-field" htmlFor="employee-phone">
                <span>Contact Number</span>
                <input
                  className="erp-field"
                  type="tel"
                  id="employee-phone"
                  name="phone"
                  value={form.phone || ''}
                  onChange={(e) => change('phone', e.target.value)}
                  placeholder="+94 77 123 4567"
                />
              </label>

              <label className="supplier-editor-field" htmlFor="employee-password">
                <span>
                  {editing ? 'Update Password' : 'Password'}{' '}
                  {!editing && !isDraft && <span className="supplier-required">*</span>}
                </span>
                <input
                  className="erp-field"
                  type="password"
                  id="employee-password"
                  name="password"
                  value={form.password || ''}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(e) => change('password', e.target.value)}
                  onBlur={() => blur('password')}
                  placeholder={
                    editing
                      ? 'Leave blank to keep current password'
                      : 'Temporary password (min. 6 characters)'
                  }
                />
                {errors.password && <small className="supplier-field-error">{errors.password}</small>}
              </label>

              <div className="supplier-editor-field supplier-editor-wide">
                <span>
                  System Roles {!isDraft && <span className="supplier-required">*</span>}
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '8px 0',
                  }}
                >
                  {roles.map((r) => {
                    const rName = typeof r === 'string' ? r : r.name;
                    const selected = (form.roles || []).includes(rName);
                    return (
                      <button
                        key={rName}
                        type="button"
                        onClick={() => toggleRole(rName)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${selected ? '#0284c7' : '#cbd5e1'}`,
                          backgroundColor: selected ? '#f0f9ff' : '#ffffff',
                          color: selected ? '#0284c7' : '#334155',
                          fontWeight: selected ? 600 : 400,
                          fontSize: 'var(--erp-text-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <ShieldCheck size={14} color={selected ? '#0284c7' : '#94a3b8'} />
                        {formatRoleName(rName)}
                      </button>
                    );
                  })}
                </div>
                {errors.roles && <small className="supplier-field-error">{errors.roles}</small>}
              </div>

              <label className="supplier-editor-field" htmlFor="employee-type">
                <span>Employment Type</span>
                <select
                  className="erp-field"
                  id="employee-type"
                  name="employeeType"
                  value={form.employeeType || 'Full-time'}
                  onChange={(e) => change('employeeType', e.target.value)}
                  style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
              </label>
            </fieldset>

            <aside className="allocation-receipt allocation-inline-review" aria-label="Employee summary">
              <div className="allocation-receipt-heading">
                <span className="allocation-receipt-symbol">
                  <UserCheck size={23} />
                </span>
                <h3>Employee summary</h3>
                <p>Check the details before saving.</p>
              </div>

              <div className="allocation-receipt-section">
                <h4>Employee Profile</h4>
                <strong>{form.fullName || '—'}</strong>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge
                        status={
                          editing
                            ? form.status || (form.isActive ? 'ACTIVE' : 'INACTIVE')
                            : isDraft
                            ? 'DRAFT'
                            : 'ACTIVE'
                        }
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Staff code</dt>
                    <dd>{displayCode}</dd>
                  </div>
                  <div>
                    <dt>Username</dt>
                    <dd>{form.username ? `@${form.username}` : '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="allocation-receipt-section">
                <h4>Contact Details</h4>
                <dl>
                  {[
                    ['Email', form.email],
                    ['Phone', form.phone],
                    ['Type', form.employeeType || 'Full-time'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="allocation-receipt-notes">
                <h4>Assigned Roles</h4>
                <p>
                  {(form.roles || []).length > 0
                    ? form.roles.map(formatRoleName).join(', ')
                    : 'No roles assigned yet'}
                </p>
              </div>
            </aside>
          </div>

          <footer className="allocation-workspace-actions">
            <span>
              {isDraft
                ? 'Complete the details, then activate from View.'
                : 'Staff code is generated automatically.'}
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
              {!editing && (
                <button
                  type="button"
                  className="allocation-secondary"
                  disabled={saving || !canDraft}
                  onClick={(event) => submit(event, true)}
                >
                  Save draft
                </button>
              )}
              <button
                type="submit"
                className="allocation-primary"
                disabled={saving || (isDraft && !canDraft)}
              >
                {saving ? (
                  <LoaderCircle size={15} className="supplier-editor-spinner" />
                ) : (
                  <Save size={15} />
                )}
                {saving ? 'Saving...' : isDraft ? 'Save draft' : 'Save Employee'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
