import React, { useState, useEffect } from 'react';
import { adjustmentApi, warehouseApi, productApi, inventoryApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  SlidersHorizontal,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Eye,
  X,
  Trash2,
  Package,
} from 'lucide-react';

const ADJUSTMENT_TYPES = [
  { value: 'CYCLE_COUNT', label: 'Cycle Count Audit' },
  { value: 'DAMAGED', label: 'Damaged Goods' },
  { value: 'EXPIRED', label: 'Expired Inventory' },
  { value: 'CORRECTION', label: 'Inventory Correction' },
  { value: 'WRITE_OFF', label: 'Loss / Write-Off' },
];

export default function AdjustmentsView() {
  const [adjustments, setAdjustments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Split-view Left Panel Form State
  const [formData, setFormData] = useState({
    warehouseId: '',
    adjustmentType: 'CYCLE_COUNT',
    reason: 'Periodic physical cycle count',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing adjustment
  const [selectedAdj, setSelectedAdj] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (whList = warehouses, prodList = products, stockMap = warehouseStock) => {
    const defaultWh = whList.find((w) => w.isPrimary)?.id || (whList.length > 0 ? whList[0].id : '');
    const defaultProd = prodList.length > 0 ? prodList[0] : null;
    const sysQty = defaultProd ? stockMap[defaultProd.id] || 0 : 0;

    setFormData({
      warehouseId: defaultWh,
      adjustmentType: 'CYCLE_COUNT',
      reason: 'Periodic physical cycle count',
      remarks: '',
      items: [
        {
          productId: defaultProd ? defaultProd.id : '',
          systemQuantity: sysQty,
          physicalQuantity: sysQty,
          adjustmentQuantity: 0,
          reason: 'Count variance',
        },
      ],
    });
  };

  const loadStockForWarehouse = async (whId) => {
    if (!whId) return {};
    try {
      const res = await inventoryApi.getWarehouseStock(whId);
      const stockMap = {};
      (res.data || []).forEach((b) => {
        stockMap[b.productId] = b.quantity || 0;
      });
      setWarehouseStock(stockMap);
      return stockMap;
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
      return {};
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [adjRes, whRes, prodRes] = await Promise.all([
        adjustmentApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
      ]);

      const aList = adjRes.data?.content || adjRes.data || [];
      const whList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setAdjustments(aList);
      setWarehouses(whList);
      setProducts(prodList);

      const targetWh = formData.warehouseId || (whList.find((w) => w.isPrimary)?.id || (whList.length > 0 ? whList[0].id : ''));
      const stockMap = await loadStockForWarehouse(targetWh);

      if (formData.items.length === 0) {
        resetForm(whList, prodList, stockMap);
      }
    } catch (err) {
      addToast('Failed to load adjustments: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = async (whId) => {
    setFormData((prev) => ({ ...prev, warehouseId: whId }));
    const stockMap = await loadStockForWarehouse(whId);

    // Update systemQuantity for existing items in form
    setFormData((prev) => ({
      ...prev,
      warehouseId: whId,
      items: prev.items.map((it) => {
        const sys = stockMap[it.productId] || 0;
        return {
          ...it,
          systemQuantity: sys,
          adjustmentQuantity: (it.physicalQuantity || 0) - sys,
        };
      }),
    }));
  };

  const handleAddItem = () => {
    const defaultProd = products.length > 0 ? products[0] : null;
    const sysQty = defaultProd ? warehouseStock[defaultProd.id] || 0 : 0;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: defaultProd ? defaultProd.id : '',
          systemQuantity: sysQty,
          physicalQuantity: sysQty,
          adjustmentQuantity: 0,
          reason: 'Count variance',
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    const row = { ...updated[index] };

    if (field === 'productId') {
      const pId = Number(value);
      row.productId = pId;
      row.systemQuantity = warehouseStock[pId] || 0;
      row.physicalQuantity = row.systemQuantity;
      row.adjustmentQuantity = 0;
    } else if (field === 'physicalQuantity') {
      const phys = parseInt(value, 10) || 0;
      row.physicalQuantity = Math.max(0, phys);
      row.adjustmentQuantity = row.physicalQuantity - (row.systemQuantity || 0);
    } else if (field === 'reason') {
      row.reason = value;
    }

    updated[index] = row;
    setFormData({ ...formData, items: updated });
  };

  const calculateTotalVariance = () => {
    return formData.items.reduce((sum, it) => sum + (it.adjustmentQuantity || 0), 0);
  };

  const handleSaveAdjustment = async (processImmediately = true) => {
    if (!formData.warehouseId) {
      addToast('Please select a warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to adjust', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        warehouseId: Number(formData.warehouseId),
        adjustmentType: formData.adjustmentType,
        reason: formData.reason,
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          systemQuantity: Number(it.systemQuantity),
          physicalQuantity: Number(it.physicalQuantity),
          adjustmentQuantity: Number(it.adjustmentQuantity),
          reason: it.reason,
        })),
      };

      const res = await adjustmentApi.create(payload, processImmediately);
      const adjNum = res.data?.adjustmentNumber || 'adjustment';
      addToast(
        `Adjustment ${adjNum} created ${processImmediately ? 'and applied to stock!' : 'as draft.'}`,
        'success'
      );
      resetForm();
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to save adjustment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessExisting = async (id, adjNum) => {
    try {
      await adjustmentApi.process(id);
      addToast(`Adjustment ${adjNum} approved and stock updated!`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to process adjustment: ' + err.message, 'error');
    }
  };

  const handleInspectAdjustment = async (id) => {
    try {
      const res = await adjustmentApi.getById(id);
      setSelectedAdj(res.data);
    } catch (err) {
      addToast('Failed to load adjustment details: ' + err.message, 'error');
    }
  };

  const filteredAdjustments = adjustments.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.adjustmentNumber?.toLowerCase().includes(q) ||
      a.warehouseName?.toLowerCase().includes(q) ||
      a.reason?.toLowerCase().includes(q) ||
      a.adjustmentType?.toLowerCase().includes(q)
    );
  });

  const netVariance = calculateTotalVariance();

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <SlidersHorizontal size={26} color="#2563eb" /> Stock Adjustments & Counts
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Cycle counts, loss write-offs, and physical audits — log adjustments on the left while monitoring audit logs on the right
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-glass" onClick={loadData} title="Refresh records">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Split View Container: Left Form + Right Table */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT PANEL: Adjustment Entry Form */}
        <div
          className="glass-card"
          style={{
            flex: '1 1 440px',
            maxWidth: '540px',
            padding: '22px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} color="#2563eb" />
              <h2 style={{ fontSize: '1.15rem', color: '#0f172a', margin: 0 }}>
                New Stock Adjustment
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-glass btn-sm"
              onClick={() => resetForm()}
              title="Reset fields"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          {/* Warehouse & Adjustment Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                TARGET WAREHOUSE *
              </label>
              <select
                className="input-glass"
                value={formData.warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isPrimary ? '(Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                ADJUSTMENT TYPE *
              </label>
              <select
                className="input-glass"
                value={formData.adjustmentType}
                onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
              >
                {ADJUSTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason & Remarks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                PRIMARY REASON *
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="e.g. Monthly physical count"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                REMARKS / NOTES
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="Audit notes or references..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </div>

          {/* Adjustment Item Lines */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                AUDITED ITEMS ({formData.items.length})
              </span>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={handleAddItem}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                <Plus size={13} /> Add Line
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {formData.items.map((item, index) => {
                const variance = item.adjustmentQuantity || 0;
                return (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '8px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        Product
                      </label>
                      <select
                        className="input-glass"
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        System Qty
                      </label>
                      <div
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#475569',
                          background: '#e2e8f0',
                          borderRadius: '6px',
                          textAlign: 'center',
                        }}
                      >
                        {item.systemQuantity ?? 0}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        New Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-glass"
                        style={{ padding: '5px 8px', fontSize: '0.82rem', textAlign: 'center' }}
                        value={item.physicalQuantity}
                        onChange={(e) => handleItemChange(index, 'physicalQuantity', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        Variance
                      </label>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          paddingTop: '6px',
                          color: variance > 0 ? '#16a34a' : variance < 0 ? '#dc2626' : '#64748b',
                        }}
                      >
                        {variance > 0 ? `+${variance}` : variance}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '4px' }}>
                      {formData.items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Remove line"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <div style={{ width: '23px' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Variance Summary Bar */}
          <div
            style={{
              padding: '12px 14px',
              background: '#f1f5f9',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid #cbd5e1',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Net Stock Variance:</span>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: netVariance > 0 ? '#16a34a' : netVariance < 0 ? '#dc2626' : '#334155',
              }}
            >
              {netVariance > 0 ? `+${netVariance}` : netVariance} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>units</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSaveAdjustment(true)}
              disabled={saving}
              title="Posts adjustment directly to warehouse inventory"
            >
              <CheckCircle size={15} />
              {saving ? 'Processing...' : 'Apply Adjustment Directly'}
            </button>
            <button
              type="button"
              className="btn btn-glass"
              style={{ flex: 1, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSaveAdjustment(false)}
              disabled={saving}
              title="Save as pending adjustment"
            >
              Save Draft
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Adjustments Records Table & Search */}
        <div
          className="glass-card"
          style={{
            flex: '1 1 540px',
            minWidth: '340px',
            padding: '22px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '36px', width: '100%', fontSize: '0.85rem' }}
                placeholder="Search adjustments by #, warehouse, reason, type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredAdjustments.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="glass-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Adjustment #</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading adjustments...
                    </td>
                  </tr>
                ) : filteredAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No adjustment records found. Use the left panel to create a new count or adjustment.
                    </td>
                  </tr>
                ) : (
                  filteredAdjustments.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => handleInspectAdjustment(a.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to view adjustment details"
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                          {a.adjustmentNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{a.warehouseName}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                          {a.adjustmentType}
                        </span>
                      </td>
                      <td>
                        {a.status === 'PROCESSED' ? (
                          <span className="badge badge-success">Processed</span>
                        ) : a.status === 'PENDING' ? (
                          <span className="badge badge-warning">Pending</span>
                        ) : (
                          <span className="badge badge-danger">{a.status}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.reason || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {a.status === 'PENDING' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessExisting(a.id, a.adjustmentNumber);
                            }}
                            title="Process Adjustment"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <CheckCircle size={13} /> Apply
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inspection Drawer / Modal */}
      {selectedAdj && (
        <div className="modal-backdrop" onClick={() => setSelectedAdj(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '1020px', padding: '30px', background: '#ffffff', borderRadius: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Adjustment Details
                </span>
                <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#2563eb" /> {selectedAdj.adjustmentNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAdj(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>WAREHOUSE</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedAdj.warehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>ADJUSTMENT TYPE</div>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedAdj.adjustmentType}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>STATUS</div>
                <div>
                  <span className={`badge ${selectedAdj.status === 'PROCESSED' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedAdj.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>DATE</div>
                <div style={{ color: '#334155' }}>
                  {selectedAdj.createdAt ? new Date(selectedAdj.createdAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#475569' }}>
              <div><span style={{ fontWeight: 600 }}>Reason:</span> {selectedAdj.reason}</div>
              {selectedAdj.remarks && (
                <div><span style={{ fontWeight: 600 }}>Remarks:</span> {selectedAdj.remarks}</div>
              )}
            </div>

            <h3 style={{ fontSize: '0.95rem', color: '#0f172a', marginBottom: '8px' }}>Adjusted Item Lines</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Sys Qty</th>
                    <th style={{ textAlign: 'right' }}>New Count</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAdj.items?.map((it, idx) => {
                    const variance = it.adjustmentQuantity || 0;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</td>
                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{it.systemQuantity}</td>
                        <td style={{ textAlign: 'right' }}>{it.physicalQuantity}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: variance > 0 ? '#16a34a' : variance < 0 ? '#dc2626' : '#64748b',
                          }}
                        >
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-glass" onClick={() => setSelectedAdj(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
