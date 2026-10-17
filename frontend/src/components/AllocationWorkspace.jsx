import React, { useState } from 'react';
import { Search, ShieldCheck, CheckCircle, Package, ChevronRight, X, Plus, Edit2, Trash2 } from 'lucide-react';
import { staffCode } from '../utils/staffCode';
import { numberError } from '../utils/purchasingValidation';
import './AllocationWorkspace.css';
import '../views/GrnView.css';

export default function AllocationWorkspace({
  form,
  onChange,
  editing,
  products,
  staff,
  productResults,
  staffResults,
  productQuery,
  onProductQuery,
  staffQuery,
  onStaffQuery,
  stockInfo,
  getStock,
  loadingStock,
  saving,
  onSave,
  onCancel,
}) {
  const [touched, setTouched] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);

  const items = form.items || [];
  const product = products.find((p) => String(p.id) === String(form.productId));
  const person = staff.find((p) => String(p.id) === String(form.userId));
  const productName = product?.name || editing?.productName;
  const staffName = person?.fullName || person?.username || editing?.userFullName || editing?.username;
  const available = Number(stockInfo?.availableStock ?? getStock(form.productId).available ?? 0);
  const unit = stockInfo?.unit || product?.unitOfMeasure || 'Units';
  const error = numberError(form.allocatedQuantity, 'Allocated quantity', { positive: true, decimals: 2, max: 9999999999.99 });
  const exceeds = !error && Number(form.allocatedQuantity) > available;

  const isDraftEdit = editing?.status === 'DRAFT';
  const identityLocked = Boolean(editing && !isDraftEdit);

  // Staging validation
  const canAddItem = Boolean(
    form.productId &&
    form.allocatedQuantity &&
    !error &&
    !exceeds &&
    available > 0 &&
    !loadingStock &&
    !saving
  );

  // Draft validation
  const hasDraftInput = Boolean(
    items.length > 0 ||
    form.productId ||
    form.userId ||
    String(form.allocatedQuantity || '').trim() ||
    (form.notes || '').trim()
  );
  const canDraft =
    hasDraftInput &&
    (!form.allocatedQuantity || !error) &&
    !saving &&
    (form.notes || '').length <= 255 &&
    (!editing || isDraftEdit);

  // Final allocation submit validation
  const hasStagedValid = Boolean(
    form.productId &&
    form.userId &&
    form.allocatedQuantity &&
    !error &&
    !exceeds &&
    available > 0 &&
    !loadingStock
  );
  const stagedHasError = Boolean(
    form.allocatedQuantity && (error || exceeds)
  );

  const canSave =
    !saving &&
    (form.notes || '').length <= 255 &&
    !stagedHasError &&
    (editing && !isDraftEdit
      ? !error && !exceeds && available > 0 && !loadingStock
      : form.userId && (items.length > 0 || hasStagedValid));

  const change = (field, value) => onChange((previous) => ({ ...previous, [field]: value }));

  const chooseProduct = (selectedProduct) => {
    change('productId', String(selectedProduct.id));
    onProductQuery('');
    setProductOpen(false);
  };

  const chooseStaff = (selectedPerson) => {
    change('userId', String(selectedPerson.id));
    onStaffQuery('');
    setStaffOpen(false);
  };

  const closeOnBlur = (event, setOpen) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  // Multi-item handlers
  const handleAddItem = () => {
    if (!canAddItem || !product) return;
    const qty = Number(form.allocatedQuantity);
    const newItem = {
      productId: String(product.id),
      productName: product.name,
      productSku: product.sku || '',
      brandName: product.brandName || '',
      categoryName: product.categoryName || '',
      availableStock: available,
      unit: unit,
      allocatedQuantity: qty,
      notes: form.notes || '',
    };

    let nextItems;
    if (editingItemIndex !== null) {
      nextItems = [...items];
      nextItems[editingItemIndex] = newItem;
      setEditingItemIndex(null);
    } else {
      const existingIdx = items.findIndex((it) => String(it.productId) === String(product.id));
      if (existingIdx >= 0) {
        nextItems = [...items];
        nextItems[existingIdx] = newItem;
      } else {
        nextItems = [...items, newItem];
      }
    }

    onChange((prev) => ({
      ...prev,
      items: nextItems,
      productId: '',
      allocatedQuantity: '',
    }));
    onProductQuery('');
    setProductOpen(false);
  };

  const handleEditItem = (index) => {
    const item = items[index];
    if (!item) return;
    setEditingItemIndex(index);
    onChange((prev) => ({
      ...prev,
      productId: item.productId,
      allocatedQuantity: String(item.allocatedQuantity),
    }));
    onProductQuery(item.productSku ? `${item.productSku} — ${item.productName}` : item.productName);
  };

  const handleRemoveItem = (index) => {
    const nextItems = items.filter((_, i) => i !== index);
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      onChange((prev) => ({
        ...prev,
        items: nextItems,
        productId: '',
        allocatedQuantity: '',
      }));
    } else {
      if (editingItemIndex !== null && editingItemIndex > index) {
        setEditingItemIndex(editingItemIndex - 1);
      }
      onChange((prev) => ({ ...prev, items: nextItems }));
    }
  };

  const cancelItemEdit = () => {
    setEditingItemIndex(null);
    onChange((prev) => ({
      ...prev,
      productId: '',
      allocatedQuantity: '',
    }));
    onProductQuery('');
  };

  const totalAllocatedUnits =
    items.reduce((sum, it) => sum + Number(it.allocatedQuantity || 0), 0) +
    (form.allocatedQuantity && !error && !exceeds && editingItemIndex === null && items.length === 0
      ? Number(form.allocatedQuantity)
      : 0);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (editing?.status === 'DRAFT') {
      if (canDraft) onSave(event, 'DRAFT');
      else setTouched(true);
      return;
    }
    if (!canSave) {
      setTouched(true);
      return;
    }
    setProductOpen(false);
    setStaffOpen(false);
    onSave(event);
  };

  return (
    <form
      className="allocation-workspace purchase-document"
      aria-label={editing ? 'Edit inventory allocation' : 'New inventory allocation'}
      onSubmit={handleSubmit}
    >
      <header className="allocation-workspace-header">
        <div className="allocation-workspace-title">
          <span className="allocation-title-icon">
            <ShieldCheck size={23} />
          </span>
          <div>
            <span className="allocation-eyebrow">Inventory management</span>
            <h2 className="erp-dialog-title">
              {editing ? 'Edit inventory allocation' : 'New inventory allocation'}
            </h2>
            <p>
              {items.length > 0
                ? `${items.length} product(s) added to this allocation.`
                : 'Select staff, choose products and allocate quantities.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="purchase-inspection-close allocation-header-close"
          aria-label="Close allocation"
          title="Close"
          disabled={saving}
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </header>

      {/* Two-column GRN-style Workspace Body */}
      <div
        className="grn-workspace allocation-workspace-body"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(0, 1.35fr)',
          gap: '16px',
          padding: '16px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Column: Intake Panel */}
        <section
          className="allocation-intake-panel grn-entry"
          aria-label="Allocation inputs"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
            overflowY: 'auto',
          }}
        >
          {/* Assign Staff Field */}
          <div className="allocation-selector" onBlur={(event) => closeOnBlur(event, setStaffOpen)}>
            <label style={{ fontWeight: 600, fontSize: 'var(--erp-text-small)', color: '#334155' }}>
              Assign staff *
              <div className="allocation-search" style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                <input
                  className="erp-field"
                  type="search"
                  aria-label="Search allocation staff"
                  disabled={identityLocked}
                  placeholder="Search staff name, code or email..."
                  value={staffOpen ? staffQuery : staffName || staffQuery}
                  onClick={() => {
                    setStaffOpen(true);
                    setProductOpen(false);
                  }}
                  onFocus={() => {
                    setStaffOpen(true);
                    setProductOpen(false);
                  }}
                  onChange={(event) => {
                    onStaffQuery(event.target.value);
                    setStaffOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setStaffOpen(false);
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (staffResults[0]) chooseStaff(staffResults[0]);
                    }
                  }}
                />
              </div>
            </label>
            {staffOpen && !identityLocked && (
              <div className="allocation-search-results" aria-label="POS staff">
                {staffResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={`Assign ${p.fullName || p.username}`}
                    aria-pressed={String(p.id) === String(form.userId)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseStaff(p)}
                  >
                    <span className="allocation-result-main">
                      <strong>{p.fullName || p.username}</strong>
                      <small>{[staffCode(p), p.phone || p.email].filter(Boolean).join(' · ')}</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
                {!staffResults.length && <p>No matching POS staff found.</p>}
              </div>
            )}
          </div>

          {/* Product Search Field */}
          <div className="allocation-selector" onBlur={(event) => closeOnBlur(event, setProductOpen)}>
            <label style={{ fontWeight: 600, fontSize: 'var(--erp-text-small)', color: '#334155' }}>
              Product *
              <div className="allocation-search" style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                <input
                  className="erp-field"
                  type="search"
                  aria-label="Search allocation products"
                  placeholder="Search product code, name or barcode..."
                  disabled={identityLocked}
                  value={
                    productOpen
                      ? productQuery
                      : productName
                      ? `${product?.sku || editing?.productSku || ''} — ${productName}`
                      : productQuery
                  }
                  onClick={() => {
                    setProductOpen(true);
                    setStaffOpen(false);
                  }}
                  onFocus={() => {
                    setProductOpen(true);
                    setStaffOpen(false);
                  }}
                  onChange={(event) => {
                    onProductQuery(event.target.value);
                    setProductOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setProductOpen(false);
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const first = productResults.find((p) => !getStock(p.id).isOutOfStock);
                      if (first) chooseProduct(first);
                    }
                  }}
                />
              </div>
            </label>
            {productOpen && !identityLocked && (
              <div className="allocation-search-results" aria-label="Allocation product results">
                {productResults.map((p) => {
                  const stock = getStock(p.id);
                  const selectedProd = String(p.id) === String(form.productId);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={selectedProd ? 'is-selected' : ''}
                      aria-label={`Select product ${p.sku || p.name}`}
                      aria-pressed={selectedProd}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseProduct(p)}
                    >
                      <span className="allocation-result-main">
                        <small>{p.sku || '—'}</small>
                        <strong>{p.name}</strong>
                        <span>{[p.brandName, p.categoryName].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="allocation-result-stock">
                        <small>Available</small>
                        <strong>
                          {Number(stock.available).toLocaleString()} <small>{stock.unit}</small>
                        </strong>
                      </span>
                      {selectedProd && <CheckCircle size={16} />}
                    </button>
                  );
                })}
                {!productResults.length && <p>No matching products found.</p>}
              </div>
            )}
          </div>

          {/* Live stock indicator */}
          <div className="allocation-stock-inline" style={{ marginTop: '-4px' }}>
            <Package size={16} />
            <span>Available stock</span>
            <strong>
              {form.productId
                ? loadingStock
                  ? 'Checking...'
                  : `${available.toLocaleString()} ${unit}`
                : 'Select a product'}
            </strong>
          </div>

          {/* Staged Line Fields */}
          <label style={{ fontWeight: 600, fontSize: 'var(--erp-text-caption)', color: '#475569' }}>
            Allocated quantity *
            <div className="allocation-quantity-input" style={{ position: 'relative' }}>
              <input
                className="erp-field"
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                inputMode="decimal"
                aria-label="Allocated quantity"
                required
                value={form.allocatedQuantity || ''}
                placeholder="Enter quantity"
                onChange={(event) => change('allocatedQuantity', event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={Boolean(exceeds || (touched && error))}
              />
              <span style={{ position: 'absolute', right: '12px', top: '12px', color: '#64748b' }}>{unit}</span>
            </div>
            {(exceeds || (touched && error)) && (
              <small className="allocation-field-error" style={{ color: '#e11d48' }}>
                {error || `Only ${available.toLocaleString()} ${unit} are available.`}
              </small>
            )}
          </label>

          {/* Staged product review receipt */}
          {product ? (
            <div
              className="allocation-receipt allocation-inline-review"
              aria-label="Allocation review receipt"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                margin: '2px 0',
              }}
            >
              <div className="allocation-receipt-section" style={{ padding: 0, border: 'none' }}>
                <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>Product code</dt>
                    <dd style={{ margin: 0, fontSize: 'var(--erp-text-caption)', fontWeight: 600 }}>
                      {product?.sku || editing?.productSku || '—'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>Brand / category</dt>
                    <dd style={{ margin: 0, fontSize: 'var(--erp-text-caption)', fontWeight: 600 }}>
                      {[product?.brandName, product?.categoryName].filter(Boolean).join(' / ') || '—'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>Available stock</dt>
                    <dd style={{ margin: 0, fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#0284c7' }}>
                      {available.toLocaleString()} {unit}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {/* Add / Update item button */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary grn-add-item erp-button"
              style={{
                flex: 1,
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              disabled={!canAddItem}
              onClick={handleAddItem}
            >
              {editingItemIndex === null ? <Plus size={15} /> : <Edit2 size={15} />}
              {editingItemIndex === null ? 'Add to allocation' : 'Update item'}
            </button>
            {editingItemIndex !== null && (
              <button
                type="button"
                className="btn btn-glass erp-button"
                style={{ height: '36px' }}
                onClick={cancelItemEdit}
              >
                Cancel edit
              </button>
            )}
          </div>

          {/* Remarks / notes */}
          <label style={{ fontWeight: 600, fontSize: 'var(--erp-text-caption)', color: '#475569' }}>
            Remarks / notes
            <textarea
              className="erp-field"
              aria-label="Allocation notes"
              rows={3}
              maxLength={255}
              value={form.notes || ''}
              placeholder="Optional notes for this allocation"
              onChange={(event) => change('notes', event.target.value)}
            />
            <small className="allocation-notes-count">{(form.notes || '').length}/255</small>
          </label>
          {identityLocked && (
            <p className="allocation-input-hint">Product and staff remain assigned when editing this allocation.</p>
          )}
        </section>

        {/* Right Column: Multi-Product Allocated Items Table */}
        <div className="grn-items" style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 'var(--erp-text-body)', fontWeight: 800, color: '#1e293b' }}>
              Allocated items ({items.length})
            </span>
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
              Total units: <strong style={{ color: '#1d4ed8' }}>{totalAllocatedUnits}</strong>
            </span>
          </div>

          <div
            className="grn-table-scroll erp-table-scroll erp-table-frame"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <table className="glass-table erp-table" style={{ margin: 0, minWidth: '560px', width: '100%' }}>
              <thead>
                <tr>
                  <th className="erp-table-heading">Product code</th>
                  <th className="erp-table-heading">Product name</th>
                  <th className="grn-number erp-table-heading">Available stock</th>
                  <th className="grn-number erp-table-heading">Allocated qty</th>
                  <th className="grn-number erp-table-heading erp-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="grn-empty erp-table-cell"
                      style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}
                    >
                      Search a product and add it to the allocation.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={`${item.productId}-${index}`}
                      className={editingItemIndex === index ? 'grn-editing-row' : ''}
                    >
                      <td className="erp-table-cell">
                        <strong className="grn-product-code" style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                          {item.productSku || '—'}
                        </strong>
                      </td>
                      <td className="erp-table-cell">
                        <div>
                          <strong>{item.productName}</strong>
                          {(item.brandName || item.categoryName) && (
                            <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                              {[item.brandName, item.categoryName].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="grn-number erp-table-cell">
                        {item.availableStock != null
                          ? `${Number(item.availableStock).toLocaleString()} ${item.unit || ''}`
                          : '—'}
                      </td>
                      <td className="grn-number erp-table-cell" style={{ fontWeight: 700, color: '#16a34a' }}>
                        {Number(item.allocatedQuantity).toLocaleString()} {item.unit || ''}
                      </td>
                      <td className="grn-number erp-table-cell erp-table-actions">
                        <div className="grn-row-actions" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="erp-table-icon-action"
                            type="button"
                            title="Edit line"
                            aria-label={`Edit item ${index + 1}`}
                            onClick={() => handleEditItem(index)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="erp-table-icon-action"
                            data-tone="danger"
                            type="button"
                            title="Remove line"
                            aria-label={`Remove item ${index + 1}`}
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="allocation-workspace-actions">
        <span>
          <ShieldCheck size={14} />
          {form.userId ? `Assigned to ${staffName || 'selected staff'}` : 'Select a product and staff member to continue.'}
        </span>
        <div>
          <button type="button" className="allocation-secondary" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
          {!editing && (
            <button
              type="button"
              className="allocation-secondary"
              disabled={!canDraft}
              onClick={(event) => onSave(event, 'DRAFT')}
            >
              Save draft
            </button>
          )}
          <button
            type="submit"
            className="allocation-primary"
            disabled={editing?.status === 'DRAFT' ? !canDraft : !canSave}
          >
            {saving
              ? 'Saving...'
              : editing?.status === 'DRAFT'
              ? 'Save draft'
              : editing
              ? 'Save changes'
              : 'Allocate'}
          </button>
        </div>
      </footer>
    </form>
  );
}
