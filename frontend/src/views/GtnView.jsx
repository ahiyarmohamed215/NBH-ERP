import React, { useState, useEffect } from 'react';
import { gtnApi, warehouseApi, productApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  X
} from 'lucide-react';

export default function GtnView() {
  const [gtns, setGtns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
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
      const [gtnRes, whRes, prodRes] = await Promise.all([
        gtnApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 200, activeOnly: true }),
      ]);
      setGtns(gtnRes.data?.content || gtnRes.data || []);
      const whList = whRes.data || [];
      setWarehouses(whList);
      setProducts(prodRes.data?.content || prodRes.data || []);
    } catch (err) {
      addToast('Failed to load GTNs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    const srcId = warehouses.length > 0 ? warehouses[0].id : '';
    const dstId = warehouses.length > 1 ? warehouses[1].id : (warehouses[0]?.id || '');
    setFormData({
      sourceWarehouseId: srcId,
      destinationWarehouseId: dstId,
      remarks: '',
      items: [
        {
          productId: products.length > 0 ? products[0].id : '',
          quantityTransferred: 1,
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
          quantityTransferred: 1,
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
    } else if (field === 'quantityTransferred') {
      row.quantityTransferred = parseInt(value, 10) || 0;
    }
    updated[index] = row;
    setFormData({ ...formData, items: updated });
  };

  const handleSaveGtn = async (transferImmediately = true) => {
    if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
      addToast('Please select both source and destination warehouses', 'error');
      return;
    }
    if (formData.sourceWarehouseId === formData.destinationWarehouseId) {
      addToast('Source and Destination warehouse cannot be the same', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one item to transfer', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        sourceWarehouseId: Number(formData.sourceWarehouseId),
        destinationWarehouseId: Number(formData.destinationWarehouseId),
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityTransferred: Number(it.quantityTransferred),
        })),
      };

      const res = await gtnApi.create(payload, transferImmediately);
      addToast(
        `GTN ${res.data?.gtnNumber || 'transfer'} created ${transferImmediately ? 'and dispatched!' : 'as draft.'}`,
        'success'
      );
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create GTN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteTransfer = async (id, gtnNumber) => {
    try {
      await gtnApi.transfer(id);
      addToast(`GTN ${gtnNumber} transferred! Stocks updated in both warehouses.`, 'success');
      loadData();
    } catch (err) {
      addToast('Transfer failed: ' + err.message, 'error');
    }
  };

  const filteredGtns = gtns.filter((g) => {
    const q = searchTerm.toLowerCase();
    return (
      g.gtnNumber?.toLowerCase().includes(q) ||
      g.sourceWarehouseName?.toLowerCase().includes(q) ||
      g.destinationWarehouseName?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowRightLeft size={28} color="#2563eb" /> Goods Transfer Notes (GTN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Inter-warehouse stock movements with ledger tracking and verification
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} /> New Stock Transfer
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
            placeholder="Search GTNs by transfer number or warehouse..."
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
                <th>GTN Number</th>
                <th>Source Warehouse</th>
                <th>Destination Warehouse</th>
                <th>Status</th>
                <th>Transfer Date</th>
                <th>Remarks</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading transfer notes...
                  </td>
                </tr>
              ) : filteredGtns.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No stock transfers found. Click "New Stock Transfer" to initiate transfer.
                  </td>
                </tr>
              ) : (
                filteredGtns.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        {g.gtnNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{g.sourceWarehouseName}</td>
                    <td style={{ fontWeight: 600, color: '#2563eb' }}>{g.destinationWarehouseName}</td>
                    <td>
                      {g.status === 'TRANSFERRED' ? (
                        <span className="badge badge-success">Transferred</span>
                      ) : g.status === 'PENDING' ? (
                        <span className="badge badge-warning">Pending</span>
                      ) : (
                        <span className="badge badge-danger">Cancelled</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {g.transferredAt ? new Date(g.transferredAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{g.remarks || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {g.status === 'PENDING' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleExecuteTransfer(g.id, g.gtnNumber)}
                        >
                          <CheckCircle size={14} /> Execute Transfer
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

      {/* New GTN Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '760px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={22} color="#2563eb" /> New Inter-Warehouse Transfer
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  SOURCE WAREHOUSE (FROM) *
                </label>
                <select
                  className="input-glass"
                  value={formData.sourceWarehouseId}
                  onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
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
                  DESTINATION WAREHOUSE (TO) *
                </label>
                <select
                  className="input-glass"
                  value={formData.destinationWarehouseId}
                  onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>TRANSFER ITEMS</span>
                <button type="button" className="btn btn-glass btn-sm" onClick={handleAddItem}>
                  <Plus size={14} /> Add Item Row
                </button>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '70%' }}>Product</th>
                      <th style={{ width: '25%' }}>Transfer Quantity</th>
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
                            value={item.quantityTransferred}
                            onChange={(e) => handleItemChange(idx, 'quantityTransferred', e.target.value)}
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

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                REMARKS / TRANSFER REASON
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="e.g. Branch stock replenishment, high demand..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
                onClick={() => handleSaveGtn(true)}
                disabled={saving}
              >
                {saving ? 'Transferring...' : 'Execute Stock Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
