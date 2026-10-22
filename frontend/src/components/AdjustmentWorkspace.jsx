import React, { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Save, X, Plus, Minus, Search, Edit2, Trash2, Package } from "lucide-react";
import { adjustmentApi } from "../api/apiClient";
import FilterSelect from "./FilterSelect";
import "./AllocationWorkspace.css";
import "./MasterWorkspace.css";
import "./AdjustmentWorkspace.css";
import "../views/GrnView.css";

export default function AdjustmentWorkspace({
  form,
  onChange,
  canSeeCost,
  editing,
  busy,
  onSave,
  onSaveDraft,
  onClose,
}) {
  const search = useRef(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);

  const items = form.items || [];
  const selected = form.selectedProduct;
  const current = Number(selected?.availableStock || 0);
  const quantity = Number(form.quantity || 0);
  const after = form.type === "Reduction" ? current - quantity : current + quantity;

  const change = (field, value) =>
    onChange((previous) => ({ ...previous, [field]: value }));

  useEffect(() => {
    if (!form.type) return;
    let alive = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await adjustmentApi.searchProducts(query);
        if (alive) {
          const list = response.data?.data || response.data || [];
          // If items already exist, prioritize products from the same warehouse
          setOptions(list);
          setHighlight(0);
        }
      } catch (err) {
        if (alive) setError(err.message || "Unable to search products.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, form.type]);

  useEffect(() => {
    if (form.type) search.current?.focus();
  }, [form.type]);

  useEffect(() => {
    if (form.type) return;
    const close = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [form.type, onClose]);

  const choose = (product) => {
    onChange((previous) => ({
      ...previous,
      productId: String(product.productId),
      warehouseId: String(product.warehouseId),
      selectedProduct: product,
    }));
    setQuery("");
    setOpen(false);
  };

  const reasons =
    form.type === "Reduction"
      ? [
          "Stock count variance",
          "Damaged stock",
          "Expired stock",
          "Internal consumption",
          "Other adjustment",
        ]
      : [
          "Found stock",
          "Stock count variance",
          "Opening stock correction",
          "Other adjustment",
        ];

  // Multi-item handlers
  const handleAddItem = () => {
    if (!selected || !form.quantity || quantity <= 0) return;
    if (form.type === "Reduction" && after < 0) return;

    const newItem = {
      productId: String(selected.productId),
      productName: selected.productName,
      productCode: selected.productCode,
      warehouseId: String(selected.warehouseId),
      warehouseName: selected.warehouseName,
      availableStock: current,
      sourceGrnNumber: selected.sourceGrnNumber,
      sourceGrnId: selected.sourceGrnId,
      unitCost: selected.unitCost,
      quantity: quantity,
      reason: form.reason || reasons[0],
      remarks: form.remarks || "",
      after: after,
    };

    let nextItems;
    if (editingIndex !== null) {
      nextItems = [...items];
      nextItems[editingIndex] = newItem;
      setEditingIndex(null);
    } else {
      const existingIdx = items.findIndex(
        (it) => String(it.productId) === String(selected.productId)
      );
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
      productId: "",
      warehouseId: nextItems.length > 0 ? nextItems[0].warehouseId : prev.warehouseId,
      selectedProduct: null,
      quantity: "",
      remarks: "",
    }));
    setQuery("");
    setOpen(false);
  };

  const handleEditItem = (index) => {
    const item = items[index];
    if (!item) return;
    setEditingIndex(index);
    onChange((prev) => ({
      ...prev,
      productId: item.productId,
      warehouseId: item.warehouseId,
      selectedProduct: {
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        availableStock: item.availableStock,
        sourceGrnNumber: item.sourceGrnNumber,
        sourceGrnId: item.sourceGrnId,
        unitCost: item.unitCost,
      },
      quantity: String(item.quantity),
      reason: item.reason || prev.reason,
      remarks: item.remarks || "",
    }));
    setQuery(`${item.productName} (${item.productCode})`);
  };

  const handleRemoveItem = (index) => {
    const nextItems = items.filter((_, i) => i !== index);
    if (editingIndex === index) {
      setEditingIndex(null);
      onChange((prev) => ({
        ...prev,
        items: nextItems,
        productId: "",
        selectedProduct: null,
        quantity: "",
        remarks: "",
      }));
    } else {
      if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
      onChange((prev) => ({ ...prev, items: nextItems }));
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    onChange((prev) => ({
      ...prev,
      productId: "",
      selectedProduct: null,
      quantity: "",
      remarks: "",
    }));
    setQuery("");
  };

  const totalAdjustedUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0) + (selected && quantity > 0 && editingIndex === null && items.length === 0 ? quantity : 0);

  const stagedHasExceed = form.type === "Reduction" && selected && form.quantity && after < 0;
  const hasItems = items.length > 0;
  const hasStaged = Boolean(selected && form.quantity && quantity > 0 && !stagedHasExceed);

  const canSubmit = !busy && (hasItems || hasStaged) && !stagedHasExceed;
  const canDraft = !busy && (hasItems || Boolean(selected && quantity > 0));

  if (!form.type)
    return (
      <div className="modal-backdrop purchasing-no-shadows adjustment-type-backdrop">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjustment-type-title"
          className="adjustment-type-dialog"
        >
          <header>
            <div>
              <h2 id="adjustment-type-title">New stock adjustment</h2>
              <p>How do you need to change stock?</p>
            </div>
            <button
              type="button"
              aria-label="Close stock adjustment"
              className="erp-table-icon-action"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>
          <div className="adjustment-type-options">
            <button
              type="button"
              autoFocus
              className="adjustment-type-choice"
              onClick={() =>
                onChange((previous) => ({
                  ...previous,
                  type: "Addition",
                  reason: "Found stock",
                }))
              }
            >
              <span className="adjustment-type-symbol">
                <Plus size={20} />
              </span>
              <span>
                Addition<small>Add stock found during a count</small>
              </span>
            </button>
            <button
              type="button"
              className="adjustment-type-choice"
              onClick={() =>
                onChange((previous) => ({
                  ...previous,
                  type: "Reduction",
                  reason: "Stock count variance",
                }))
              }
            >
              <span className="adjustment-type-symbol">
                <Minus size={20} />
              </span>
              <span>
                Reduction<small>Reduce damaged or missing stock</small>
              </span>
            </button>
          </div>
          <footer>
            <button
              type="button"
              className="btn btn-glass erp-button"
              onClick={onClose}
            >
              Cancel
            </button>
          </footer>
        </section>
      </div>
    );

  return (
    <form
      noValidate
      className="allocation-workspace purchase-document master-workspace adjustment-workspace"
      aria-label="New stock adjustment"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(event, false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          if (open) {
            setOpen(false);
            event.preventDefault();
          } else if (!busy) onClose();
        }
      }}
    >
      <header className="allocation-workspace-header">
        <div className="allocation-workspace-title">
          <span className="allocation-title-icon">
            <SlidersHorizontal size={23} />
          </span>
          <div>
            <h2 className="erp-dialog-title">
              Stock {form.type === "Reduction" ? "reduction" : "addition"}
            </h2>
            <p>
              {editing
                ? `${editing.status === "DRAFT" ? "Edit draft" : "New correction for"} ${editing.recordNo}`
                : items.length > 0
                ? `${items.length} product(s) added to this adjustment.`
                : "Choose a product and enter the quantity to adjust."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="allocation-header-close"
          aria-label="Close stock adjustment editor"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>

      {/* Two-column GRN-style workspace body */}
      <div className="grn-workspace allocation-workspace-body" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.9fr) minmax(0, 1.35fr)", gap: "16px", padding: "16px", flex: 1, minHeight: 0 }}>
        {/* Left Column: Intake & Staging Panel */}
        <div className="grn-entry" style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0, overflowY: "auto" }}>
          <div
            className="adjustment-product-search"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setOpen(false);
            }}
          >
            <label htmlFor="adjustment-product-search" style={{ fontWeight: 600, fontSize: "var(--erp-text-small)", color: "#334155" }}>Product *</label>
            <div className="adjustment-search-input" style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "11px", color: "#64748b" }} />
              <input
                ref={search}
                id="adjustment-product-search"
                className="erp-field"
                role="combobox"
                aria-label="Search adjustment products"
                aria-expanded={open}
                aria-controls="adjustment-product-options"
                aria-autocomplete="list"
                aria-activedescendant={
                  open && options[highlight]
                    ? `adjustment-option-${highlight}`
                    : undefined
                }
                placeholder="Search product name or code..."
                value={
                  open
                    ? query
                    : selected
                    ? `${selected.productName} (${selected.productCode})`
                    : query
                }
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setOpen(true);
                    setHighlight((value) =>
                      Math.min(value + 1, options.length - 1)
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlight((value) => Math.max(0, value - 1));
                  }
                  if (event.key === "Enter" && open) {
                    event.preventDefault();
                    if (options[highlight]) choose(options[highlight]);
                  }
                }}
              />
            </div>
            {open ? (
              <div
                className="adjustment-product-options"
                id="adjustment-product-options"
                role="listbox"
                aria-label="Matching adjustment products"
              >
                {loading ? (
                  <p>Searching…</p>
                ) : error ? (
                  <p role="alert">{error}</p>
                ) : options.length ? (
                  options.map((product, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      id={`adjustment-option-${index}`}
                      key={`${product.productId}-${product.warehouseId}`}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(product)}
                    >
                      <span>
                        <strong>{product.productName}</strong>
                        <small>
                          {product.productCode} · {product.warehouseName}
                        </small>
                      </span>
                      <span className="adjustment-option-stock">
                        <strong>{product.availableStock}</strong>
                        <small>Available</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p>
                    No matching product with a processed GRN. Record a GRN first.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {selected ? (
            <div className="grn-product-summary" aria-live="polite">
              <div>
                <span>Warehouse</span>
                <strong>{selected.warehouseName}</strong>
              </div>
              <div>
                <span>Linked GRN</span>
                <strong>{selected.sourceGrnNumber}</strong>
              </div>
              <div>
                <span>Available stock</span>
                <strong style={{ color: current <= 0 ? "#e11d48" : "#0284c7" }}>
                  {current}
                </strong>
              </div>
            </div>
          ) : null}

          <div className="grn-line-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "var(--erp-text-caption)", fontWeight: 600, color: "#475569" }}>
              Quantity to {form.type === "Reduction" ? "reduce" : "add"} *
              <input
                className="erp-field"
                aria-label="Adjustment quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity || ""}
                onFocus={() => setOpen(false)}
                onChange={(event) => change("quantity", event.target.value)}
              />
              {stagedHasExceed && (
                <p className="adjustment-error" role="alert" style={{ margin: "4px 0 0", color: "#e11d48", fontSize: "var(--erp-text-caption)" }}>
                  Reduction exceeds available stock.
                </p>
              )}
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "var(--erp-text-caption)", fontWeight: 600, color: "#475569" }}>
              Reason *
              <FilterSelect
                variant="field"
                aria-label="Reason"
                value={form.reason || ""}
                onChange={(event) => change("reason", event.target.value)}
              >
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </FilterSelect>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "var(--erp-text-caption)", fontWeight: 600, color: "#475569" }}>
            Remarks
            <textarea
              className="erp-field"
              aria-label="Remarks"
              rows={2}
              maxLength={5000}
              placeholder="Adjustment notes or verification remarks"
              value={form.remarks || ""}
              onFocus={() => setOpen(false)}
              onChange={(event) => change("remarks", event.target.value)}
            />
          </label>

          {/* Staged calculation review card removed from visual display as requested */}
          <aside
            className="allocation-receipt allocation-inline-review"
            aria-label="Stock adjustment summary"
            style={{ display: "none" }}
          >
            <div className="allocation-receipt-section" style={{ padding: 0, border: "none" }}>
              <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {[
                  ["Product code", selected?.productCode],
                  ["Warehouse", selected?.warehouseName],
                  ["Linked GRN", selected?.sourceGrnNumber],
                  ["Available stock", selected ? current : null],
                  [
                    "Quantity to adjust",
                    form.quantity
                      ? `${form.type === "Reduction" ? "-" : "+"}${quantity}`
                      : null,
                  ],
                  [
                    "Available after adjustment",
                    selected && form.quantity ? after : null,
                  ],
                  ...(canSeeCost ? [["GRN unit cost", selected?.unitCost]] : []),
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <dt style={{ fontSize: "var(--erp-text-caption)", color: "#64748b" }}>{label}</dt>
                    <dd style={{ margin: 0, fontSize: "var(--erp-text-caption)", fontWeight: 600, color: label === "Available after adjustment" && after < 0 ? "#e11d48" : "#0f172a" }}>
                      {value == null || value === "" ? "—" : value}
                    </dd>
                  </div>
                ))}
              </dl>
              {stagedHasExceed ? (
                <p className="adjustment-error" role="alert" style={{ margin: "6px 0 0", color: "#e11d48", fontSize: "var(--erp-text-caption)" }}>
                  Reduction exceeds available stock.
                </p>
              ) : null}
            </div>
          </aside>

          {/* Add / Update item button */}
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            <button
              type="button"
              className="btn btn-primary grn-add-item erp-button"
              style={{ flex: 1, height: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              disabled={busy || !selected || !form.quantity || quantity <= 0 || stagedHasExceed}
              onClick={handleAddItem}
            >
              {editingIndex === null ? <Plus size={15} /> : <Edit2 size={15} />}
              {editingIndex === null ? "Add to adjustment" : "Update item"}
            </button>
            {editingIndex !== null && (
              <button
                type="button"
                className="btn btn-glass erp-button"
                style={{ height: "36px" }}
                onClick={handleCancelEdit}
              >
                Cancel edit
              </button>
            )}
          </div>

          <button
            type="button"
            className="adjustment-change-type"
            disabled={busy}
            onClick={() => change("type", "")}
            style={{ marginTop: "4px" }}
          >
            Change adjustment type
          </button>
        </div>

        {/* Right Column: Multi-Product Adjusted Items Table */}
        <div className="grn-items" style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexShrink: 0 }}>
            <span style={{ fontSize: "var(--erp-text-body)", fontWeight: 800, color: "#1e293b" }}>
              Adjusted items ({items.length})
            </span>
            <span style={{ fontSize: "var(--erp-text-small)", color: "#475569", fontWeight: 600, background: "#f1f5f9", padding: "3px 10px", borderRadius: "6px" }}>
              Total units: <strong style={{ color: "#1d4ed8" }}>{totalAdjustedUnits}</strong>
            </span>
          </div>

          <div className="grn-table-scroll erp-table-scroll erp-table-frame" style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <table className="glass-table erp-table" style={{ margin: 0, width: "100%" }}>
              <thead>
                <tr>
                  <th className="erp-table-heading">Product code</th>
                  <th className="erp-table-heading">Product name</th>
                  <th className="erp-table-heading">Warehouse</th>
                  <th className="erp-table-heading">Linked GRN</th>
                  <th className="grn-number erp-table-heading">Available</th>
                  <th className="grn-number erp-table-heading">Adjust Qty</th>
                  <th className="grn-number erp-table-heading">After</th>
                  <th className="grn-number erp-table-heading erp-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="grn-empty erp-table-cell" style={{ textAlign: "center", padding: "32px 16px", color: "#64748b" }}>
                      Search a product and add it to the adjustment.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={`${item.productId}-${index}`}
                      className={editingIndex === index ? "grn-editing-row" : ""}
                    >
                      <td className="erp-table-cell">
                        <strong className="grn-product-code" style={{ fontFamily: "monospace", color: "#0284c7" }}>
                          {item.productCode}
                        </strong>
                      </td>
                      <td className="erp-table-cell">
                        <div>
                          <strong>{item.productName}</strong>
                          {item.reason && (
                            <div style={{ fontSize: "var(--erp-text-caption)", color: "#64748b" }}>
                              {item.reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="erp-table-cell">{item.warehouseName || "—"}</td>
                      <td className="erp-table-cell">{item.sourceGrnNumber || "—"}</td>
                      <td className="grn-number erp-table-cell">{item.availableStock}</td>
                      <td className="grn-number erp-table-cell" style={{ fontWeight: 700, color: form.type === "Reduction" ? "#e11d48" : "#16a34a" }}>
                        {form.type === "Reduction" ? `-${item.quantity}` : `+${item.quantity}`}
                      </td>
                      <td className="grn-number erp-table-cell">{item.after}</td>
                      <td className="grn-number erp-table-cell erp-table-actions">
                        <div className="grn-row-actions" style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
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
        <span>The latest matching processed GRN is linked automatically.</span>
        <div>
          <button
            type="button"
            className="allocation-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="allocation-secondary"
            disabled={!canDraft}
            onClick={onSaveDraft}
          >
            <Save size={15} /> Save as draft
          </button>
          <button
            type="submit"
            className="allocation-primary"
            disabled={!canSubmit}
          >
            <Save size={15} />
            {busy ? "Submitting…" : "Submit adjustment"}
          </button>
        </div>
      </footer>
    </form>
  );
}
