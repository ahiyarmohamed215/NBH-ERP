import React, { useState, useEffect } from 'react';
import { gtnApi, warehouseApi, productApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle,
  Trash2,
  RefreshCw,
  RotateCcw,
  Eye,
  X,
  ArrowRight,
  Package,
  Printer,
  Download,
} from 'lucide-react';

export default function GtnView() {
  const [gtns, setGtns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Split-view Left Panel Form State
  const [formData, setFormData] = useState({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing transfer
  const [selectedGtn, setSelectedGtn] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (whList = warehouses, prodList = products) => {
    const srcId = whList.length > 0 ? whList[0].id : '';
    const dstId = whList.length > 1 ? whList[1].id : (whList[0]?.id || '');
    const defaultProd = prodList.length > 0 ? prodList[0] : null;

    setFormData({
      sourceWarehouseId: srcId,
      destinationWarehouseId: dstId,
      remarks: '',
      items: [
        {
          productId: defaultProd ? defaultProd.id : '',
          quantityTransferred: 1,
        },
      ],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [gtnRes, whRes, prodRes] = await Promise.all([
        gtnApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
      ]);

      const gList = gtnRes.data?.content || gtnRes.data || [];
      const whList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setGtns(gList);
      setWarehouses(whList);
      setProducts(prodList);

      if (formData.items.length === 0) {
        resetForm(whList, prodList);
      }
    } catch (err) {
      addToast('Failed to load GTN data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const defaultProd = products.length > 0 ? products[0] : null;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: defaultProd ? defaultProd.id : '',
          quantityTransferred: 1,
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
      row.productId = Number(value);
    } else if (field === 'quantityTransferred') {
      row.quantityTransferred = Math.max(1, parseInt(value, 10) || 1);
    }
    updated[index] = row;
    setFormData({ ...formData, items: updated });
  };

  const calculateTotalUnits = () => {
    return formData.items.reduce((sum, it) => sum + (it.quantityTransferred || 0), 0);
  };

  const handleSaveGtn = async (transferImmediately = true) => {
    if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
      addToast('Please select both source and destination warehouses', 'error');
      return;
    }
    if (Number(formData.sourceWarehouseId) === Number(formData.destinationWarehouseId)) {
      addToast('Source and destination warehouse cannot be the same', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to transfer', 'error');
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
      const gtnNum = res.data?.gtnNumber || 'transfer';
      addToast(
        `GTN ${gtnNum} created ${transferImmediately ? 'and dispatched to destination!' : 'as draft.'}`,
        'success'
      );
      resetForm();
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

  const handleInspectGtn = async (id) => {
    try {
      const res = await gtnApi.getById(id);
      setSelectedGtn(res.data);
    } catch (err) {
      addToast('Failed to load GTN details: ' + err.message, 'error');
    }
  };

  const filteredGtns = gtns.filter((g) => {
    const q = searchTerm.toLowerCase();
    return (
      g.gtnNumber?.toLowerCase().includes(q) ||
      g.sourceWarehouseName?.toLowerCase().includes(q) ||
      g.destinationWarehouseName?.toLowerCase().includes(q) ||
      g.remarks?.toLowerCase().includes(q)
    );
  });

  const isSameWarehouse =
    formData.sourceWarehouseId &&
    formData.destinationWarehouseId &&
    Number(formData.sourceWarehouseId) === Number(formData.destinationWarehouseId);

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <ArrowRightLeft size={26} color="#2563eb" /> Goods Transfer Notes (GTN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Inter-warehouse stock movements — initiate transfers on the left while monitoring transfer logs on the right
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
        {/* LEFT PANEL: GTN Entry Form */}
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
                New Stock Transfer
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

          {/* Warehouses Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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

          {isSameWarehouse && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>
              Source and destination warehouse must be different.
            </div>
          )}

          {/* Remarks / Transfer Reason */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              REMARKS / TRANSFER REASON
            </label>
            <input
              type="text"
              className="input-glass"
              placeholder="e.g. Branch stock replenishment, high customer demand..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>

          {/* Transfer Item Lines */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                TRANSFER ITEMS ({formData.items.length})
              </span>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={handleAddItem}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {formData.items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2.5fr 1fr auto',
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
                      Transfer Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-glass"
                      style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                      value={item.quantityTransferred}
                      onChange={(e) => handleItemChange(index, 'quantityTransferred', e.target.value)}
                    />
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
              ))}
            </div>
          </div>

          {/* Transfer Summary */}
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
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Total Units To Transfer:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>
              {calculateTotalUnits()} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>units</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSaveGtn(true)}
              disabled={saving || isSameWarehouse}
              title="Dispatches transfer immediately and updates inventory in both warehouses"
            >
              <CheckCircle size={15} />
              {saving ? 'Processing...' : 'Direct Transfer & Dispatch'}
            </button>
            <button
              type="button"
              className="btn btn-glass"
              style={{ flex: 1, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSaveGtn(false)}
              disabled={saving || isSameWarehouse}
              title="Save as pending draft without deducting stock yet"
            >
              Save Draft
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: GTN Records Table & Search */}
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
                placeholder="Search GTNs by #, source, destination, or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredGtns.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="glass-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>GTN #</th>
                  <th>Route (From → To)</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading transfer notes...
                    </td>
                  </tr>
                ) : filteredGtns.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No transfer records found. Fill the form on the left to initiate a transfer.
                    </td>
                  </tr>
                ) : (
                  filteredGtns.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => handleInspectGtn(g.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to view transfer details"
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                          {g.gtnNumber}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{g.sourceWarehouseName}</span>
                          <ArrowRight size={13} color="#94a3b8" />
                          <span style={{ fontWeight: 600, color: '#2563eb' }}>{g.destinationWarehouseName}</span>
                        </div>
                      </td>
                      <td>
                        {g.status === 'TRANSFERRED' ? (
                          <span className="badge badge-success">Transferred</span>
                        ) : g.status === 'PENDING' ? (
                          <span className="badge badge-warning">Pending</span>
                        ) : (
                          <span className="badge badge-danger">Cancelled</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {g.transferredAt
                          ? new Date(g.transferredAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : g.createdAt
                          ? new Date(g.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.remarks || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              pdfApi.printGtn(g.id);
                            }}
                            title="Print GTN Transfer Note Directly"
                            style={{ padding: '5px 9px' }}
                          >
                            <Printer size={15} color="#2563eb" />
                          </button>
                          {g.status === 'PENDING' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExecuteTransfer(g.id, g.gtnNumber);
                              }}
                              title="Execute Transfer"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <CheckCircle size={13} /> Execute
                            </button>
                          )}
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

      {/* GTN Inspection Drawer / Modal */}
      {selectedGtn && (
        <div className="modal-backdrop" onClick={() => setSelectedGtn(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '720px', padding: '26px', background: '#ffffff', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Goods Transfer Note Details
                </span>
                <h2 style={{ fontSize: '1.45rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={24} color="#2563eb" /> {selectedGtn.gtnNumber}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => pdfApi.downloadGtn(selectedGtn.id, selectedGtn.gtnNumber)}
                  style={{ fontWeight: 700, color: '#15803d', borderColor: '#86efac', padding: '7px 12px' }}
                >
                  <Download size={15} color="#15803d" /> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => pdfApi.printGtn(selectedGtn.id)}
                  style={{ fontWeight: 700, padding: '7px 14px' }}
                >
                  <Printer size={15} /> Print Direct
                </button>
                <button
                  onClick={() => setSelectedGtn(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>SOURCE WAREHOUSE</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{selectedGtn.sourceWarehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>DESTINATION WAREHOUSE</div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '1.05rem' }}>{selectedGtn.destinationWarehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>STATUS</div>
                <div>
                  <span className={`badge ${selectedGtn.status === 'TRANSFERRED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.85rem' }}>
                    {selectedGtn.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>DATE & TIME</div>
                <div style={{ color: '#334155', fontWeight: 600 }}>
                  {selectedGtn.transferredAt ? new Date(selectedGtn.transferredAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>

            {selectedGtn.remarks && (
              <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '16px', fontSize: '0.86rem', color: '#475569' }}>
                <span style={{ fontWeight: 700 }}>Remarks:</span> {selectedGtn.remarks}
              </div>
            )}

            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Transferred Item Lines</h3>
            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Product</th>
                    <th style={{ padding: '10px 14px' }}>SKU</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Qty Transferred</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGtn.items?.map((it, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', fontSize: '0.95rem' }}>
                        {it.quantityTransferred}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => pdfApi.downloadGtn(selectedGtn.id, selectedGtn.gtnNumber)}
                style={{ fontWeight: 700, color: '#15803d', borderColor: '#86efac' }}
              >
                <Download size={15} color="#15803d" /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => pdfApi.printGtn(selectedGtn.id)}
                style={{ fontWeight: 700 }}
              >
                <Printer size={15} /> Print Direct
              </button>
              <button className="btn btn-glass" onClick={() => setSelectedGtn(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
