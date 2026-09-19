import React, { useState, useEffect } from 'react';
import { prnApi, supplierApi, warehouseApi, productApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle,
  Trash2,
  RefreshCw,
  X
} from 'lucide-react';

export default function PrnView() {
  const [prns, setPrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    originalGrnNumber: '',
    reason: 'Defective batch / Damaged on arrival',
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
      const [prnRes, supRes, whRes, prodRes] = await Promise.all([
        prnApi.search({ size: 100 }),
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 200, activeOnly: true }),
      ]);
      setPrns(prnRes.data?.content || prnRes.data || []);
      setSuppliers(supRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.content || prodRes.data || []);
    } catch (err) {
      addToast('Failed to load purchase returns: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    setFormData({
      supplierId: suppliers.length > 0 ? suppliers[0].id : '',
      warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
      originalGrnNumber: '',
      reason: 'Defective batch / Damaged on arrival',
      remarks: '',
      items: [
        {
          productId: products.length > 0 ? products[0].id : '',
          quantityReturned: 1,
          unitCost: products.length > 0 ? products[0].costPrice || 0 : 0,
        },
      ],
    });
    setShowModal(true);
  };

  const handleAddItem = () => {
    const defaultProd = products.length > 0 ? products[0] : null;
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          productId: defaultProd ? defaultProd.id : '',
          quantityReturned: 1,
          unitCost: defaultProd ? defaultProd.costPrice || 0 : 0,
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
      row.productId = Number(value);
      const prod = products.find((p) => p.id === Number(value));
      if (prod) {
        row.unitCost = prod.costPrice || 0;
      }
    } else if (field === 'quantityReturned') {
      row.quantityReturned = parseInt(value, 10) || 0;
    } else if (field === 'unitCost') {
      row.unitCost = parseFloat(value) || 0;
    }
    updated[index] = row;
    setFormData({ ...formData, items: updated });
  };

  const calculateTotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + (item.quantityReturned || 0) * (item.unitCost || 0),
      0
    );
  };

  const handleSavePrn = async (processImmediately = true) => {
    if (!formData.supplierId || !formData.warehouseId) {
      addToast('Please select supplier and warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one item to return', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        supplierId: Number(formData.supplierId),
        warehouseId: Number(formData.warehouseId),
        originalGrnNumber: formData.originalGrnNumber.trim() || null,
        reason: formData.reason,
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityReturned: Number(it.quantityReturned),
          unitCost: Number(it.unitCost),
        })),
      };

      const res = await prnApi.create(payload, processImmediately);
      addToast(
        `Purchase Return ${res.data?.prnNumber || 'note'} processed successfully! Stock deducted.`,
        'success'
      );
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create PRN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredPrns = prns.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.prnNumber?.toLowerCase().includes(q) ||
      p.supplierName?.toLowerCase().includes(q) ||
      p.warehouseName?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RotateCcw size={28} color="#2563eb" /> Purchase Return Notes (PRN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Debit notes and inventory returns to suppliers for defective or excess stock
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} /> New Return to Supplier
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
            placeholder="Search PRNs by number, supplier, or warehouse..."
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
                <th>PRN Number</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Total Value</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading purchase returns...
                  </td>
                </tr>
              ) : filteredPrns.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No purchase returns recorded yet.
                  </td>
                </tr>
              ) : (
                filteredPrns.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        {p.prnNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.supplierName}</td>
                    <td>{p.warehouseName}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      ${Number(p.totalAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{p.reason}</td>
                    <td>
                      {p.status === 'PROCESSED' ? (
                        <span className="badge badge-success">Processed</span>
                      ) : (
                        <span className="badge badge-warning">{p.status}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
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
          <div className="glass-modal" style={{ width: '100%', maxWidth: '780px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={22} color="#2563eb" /> New Purchase Return to Supplier
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
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
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
                  SUPPLIER *
                </label>
                <select
                  className="input-glass"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  ORIGINAL GRN REF
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. GRN-2026-0001"
                  value={formData.originalGrnNumber}
                  onChange={(e) => setFormData({ ...formData, originalGrnNumber: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  RETURN REASON
                </label>
                <select
                  className="input-glass"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                >
                  <option value="Defective batch / Damaged on arrival">Defective batch / Damaged on arrival</option>
                  <option value="Incorrect item supplied">Incorrect item supplied</option>
                  <option value="Over-shipment / Excess stock">Over-shipment / Excess stock</option>
                  <option value="Product expired / Near expiry">Product expired / Near expiry</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>RETURN ITEMS</span>
                <button type="button" className="btn btn-glass btn-sm" onClick={handleAddItem}>
                  <Plus size={14} /> Add Item Row
                </button>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>Product</th>
                      <th style={{ width: '25%' }}>Return Qty</th>
                      <th style={{ width: '25%' }}>Unit Cost ($)</th>
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
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="input-glass"
                            value={item.quantityReturned}
                            onChange={(e) => handleItemChange(idx, 'quantityReturned', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input-glass"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                          />
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ flex: 1, marginRight: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  REMARKS
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="Additional return notes..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL CREDIT VALUE</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>
                  ${calculateTotal().toFixed(2)}
                </div>
              </div>
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
                className="btn btn-danger"
                onClick={() => handleSavePrn(true)}
                disabled={saving}
              >
                {saving ? 'Processing...' : 'Deduct Stock & Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
