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
  X,
  Trash2
} from 'lucide-react';

export default function AdjustmentsView() {
  const [adjustments, setAdjustments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    adjustmentType: 'CYCLE_COUNT',
    reason: 'Periodic physical cycle count',
    remarks: '',
    items: [],
  });

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adjRes, whRes, prodRes] = await Promise.all([
        adjustmentApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 200, activeOnly: true }),
      ]);
      setAdjustments(adjRes.data?.content || adjRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.content || prodRes.data || []);
    } catch (err) {
      addToast('Failed to load adjustments: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // When warehouse changes in modal, load its stock balances
  const handleWarehouseChange = async (whId) => {
    setFormData((prev) => ({ ...prev, warehouseId: whId }));
    if (!whId) return;
    try {
      const res = await inventoryApi.getWarehouseStock(whId);
      const stockMap = {};
      (res.data || []).forEach((b) => {
        stockMap[b.productId] = b.quantity || 0;
      });
      setWarehouseStock(stockMap);
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
    }
  };

  const handleOpenNewModal = async () => {
    const whId = warehouses.length > 0 ? warehouses[0].id : '';
    setFormData({
      warehouseId: whId,
      adjustmentType: 'CYCLE_COUNT',
      reason: 'Periodic physical cycle count',
      remarks: '',
      items: [
        {
          productId: products.length > 0 ? products[0].id : '',
          systemQuantity: 0,
          physicalQuantity: 0,
          adjustmentQuantity: 0,
          reason: 'Count variance',
        },
      ],
    });
    if (whId) {
      await handleWarehouseChange(whId);
    }
    setShowModal(true);
  };

  const handleAddItem = () => {
    const defaultProd = products.length > 0 ? products[0] : null;
    const sysQty = defaultProd ? warehouseStock[defaultProd.id] || 0 : 0;
    setFormData({
      ...formData,
      items: [
        ...formData.items,
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

  const handleRemoveItem = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
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
      row.physicalQuantity = phys;
      row.adjustmentQuantity = phys - (row.systemQuantity || 0);
    } else if (field === 'reason') {
      row.reason = value;
    }

    updated[index] = row;
    setFormData({ ...formData, items: updated });
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
      addToast(
        `Adjustment ${res.data?.adjustmentNumber || ''} created ${processImmediately ? 'and posted to inventory!' : 'as draft.'}`,
        'success'
      );
      setShowModal(false);
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
      addToast(`Adjustment ${adjNum} approved and processed!`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to process adjustment: ' + err.message, 'error');
    }
  };

  const filteredAdjustments = adjustments.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.adjustmentNumber?.toLowerCase().includes(q) ||
      a.warehouseName?.toLowerCase().includes(q) ||
      a.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SlidersHorizontal size={28} color="#2563eb" /> Stock Adjustments & Physical Audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Reconcile physical stock counts with system balances, write-offs, and damages
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} /> New Stock Adjustment
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder="Search adjustments by document number, warehouse, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Adjustment No.</th>
                <th>Warehouse</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading stock adjustments...
                  </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No stock adjustments recorded yet.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        {a.adjustmentNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{a.warehouseName}</td>
                    <td>
                      <span className="badge badge-info">{a.adjustmentType}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{a.reason}</td>
                    <td>
                      {a.status === 'PROCESSED' ? (
                        <span className="badge badge-success">Processed</span>
                      ) : a.status === 'DRAFT' ? (
                        <span className="badge badge-warning">Draft</span>
                      ) : (
                        <span className="badge badge-danger">Rejected</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {a.status === 'DRAFT' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleProcessExisting(a.id, a.adjustmentNumber)}
                        >
                          <CheckCircle size={14} /> Process
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

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '840px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={22} color="#2563eb" /> Reconcile Physical Stock Count
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  WAREHOUSE *
                </label>
                <select
                  className="input-glass"
                  value={formData.warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  ADJUSTMENT TYPE
                </label>
                <select
                  className="input-glass"
                  value={formData.adjustmentType}
                  onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
                >
                  <option value="CYCLE_COUNT">Physical Cycle Count Audit</option>
                  <option value="DAMAGED">Damaged / Broken Goods</option>
                  <option value="WRITE_OFF">Inventory Write-Off</option>
                  <option value="DISCREPANCY">Discrepancy Correction</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>AUDITED ITEMS</span>
                <button type="button" className="btn btn-glass btn-sm" onClick={handleAddItem}>
                  <Plus size={14} /> Add Product
                </button>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Product</th>
                      <th style={{ width: '15%' }}>System Qty</th>
                      <th style={{ width: '15%' }}>Physical Count</th>
                      <th style={{ width: '15%' }}>Variance (+/-)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="input-glass"
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontWeight: 600, color: '#64748b' }}>
                          {item.systemQuantity}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input-glass"
                            value={item.physicalQuantity}
                            onChange={(e) => handleItemChange(idx, 'physicalQuantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                item.adjustmentQuantity > 0
                                  ? '#059669'
                                  : item.adjustmentQuantity < 0
                                  ? '#dc2626'
                                  : '#64748b',
                            }}
                          >
                            {item.adjustmentQuantity > 0
                              ? `+${item.adjustmentQuantity}`
                              : item.adjustmentQuantity}
                          </span>
                        </td>
                        <td>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                AUDIT REASON & REMARKS
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="Reason for discrepancy or audit justification..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSaveAdjustment(true)}
                disabled={saving}
              >
                {saving ? 'Processing...' : 'Apply Stock Discrepancy Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
