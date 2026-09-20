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
  Eye,
  X,
  Package,
} from 'lucide-react';

const COMMON_REASONS = [
  'Defective batch / Damaged on arrival',
  'Incorrect items / wrong specification',
  'Quality inspection rejection',
  'Excess stock / over-supplied',
  'Near expiry / damaged packaging',
  'Other supplier return',
];

export default function PrnView() {
  const [prns, setPrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Split-view Left Panel Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    originalGrnNumber: '',
    reason: COMMON_REASONS[0],
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing PRN
  const [selectedPrn, setSelectedPrn] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (supList = suppliers, whList = warehouses, prodList = products) => {
    const defaultSup = supList.length > 0 ? supList[0].id : '';
    const defaultWh = whList.find((w) => w.isPrimary)?.id || (whList.length > 0 ? whList[0].id : '');
    const defaultProd = prodList.length > 0 ? prodList[0] : null;

    setFormData({
      supplierId: defaultSup,
      warehouseId: defaultWh,
      originalGrnNumber: '',
      reason: COMMON_REASONS[0],
      remarks: '',
      items: [
        {
          productId: defaultProd ? defaultProd.id : '',
          quantityReturned: 1,
          unitCost: defaultProd ? defaultProd.costPrice || 0 : 0,
        },
      ],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prnRes, supRes, whRes, prodRes] = await Promise.all([
        prnApi.search({ size: 100 }),
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
      ]);

      const pList = prnRes.data?.content || prnRes.data || [];
      const sList = supRes.data || [];
      const wList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setPrns(pList);
      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(prodList);

      if (formData.items.length === 0) {
        resetForm(sList, wList, prodList);
      }
    } catch (err) {
      addToast('Failed to load purchase returns: ' + err.message, 'error');
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
          quantityReturned: 1,
          unitCost: defaultProd ? defaultProd.costPrice || 0 : 0,
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
      const prod = products.find((p) => p.id === Number(value));
      if (prod) {
        row.unitCost = prod.costPrice || 0;
      }
    } else if (field === 'quantityReturned') {
      row.quantityReturned = Math.max(1, parseInt(value, 10) || 1);
    } else if (field === 'unitCost') {
      row.unitCost = Math.max(0, parseFloat(value) || 0);
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
      addToast('Please select both supplier and warehouse', 'error');
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
      const prnNum = res.data?.prnNumber || 'note';
      addToast(
        `Purchase Return ${prnNum} ${processImmediately ? 'processed! Stock deducted.' : 'saved as draft.'}`,
        'success'
      );
      resetForm();
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create PRN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessPrn = async (id, prnNumber) => {
    try {
      await prnApi.process(id);
      addToast(`Purchase Return ${prnNumber} processed! Inventory updated.`, 'success');
      loadData();
    } catch (err) {
      addToast('Processing failed: ' + err.message, 'error');
    }
  };

  const handleInspectPrn = async (id) => {
    try {
      const res = await prnApi.getById(id);
      setSelectedPrn(res.data);
    } catch (err) {
      addToast('Failed to load PRN details: ' + err.message, 'error');
    }
  };

  const filteredPrns = prns.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.prnNumber?.toLowerCase().includes(q) ||
      p.supplierName?.toLowerCase().includes(q) ||
      p.warehouseName?.toLowerCase().includes(q) ||
      p.reason?.toLowerCase().includes(q) ||
      p.originalGrnNumber?.toLowerCase().includes(q)
    );
  });

  const totalReturnVal = calculateTotal();

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <RotateCcw size={26} color="#2563eb" /> Purchase Return Notes (PRN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Supplier returns & debit notes — log returns on the left while monitoring return logs on the right
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
        {/* LEFT PANEL: PRN Entry Form */}
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
                New Return to Supplier
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

          {/* Warehouse & Supplier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                RETURN FROM WAREHOUSE *
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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                RETURN TO SUPPLIER *
              </label>
              <select
                className="input-glass"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || s.supplierCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Original GRN # & Reason */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                ORIGINAL GRN # (OPTIONAL)
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="e.g. GRN-00012"
                value={formData.originalGrnNumber}
                onChange={(e) => setFormData({ ...formData, originalGrnNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                RETURN REASON *
              </label>
              <select
                className="input-glass"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              >
                {COMMON_REASONS.map((r, i) => (
                  <option key={i} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              REMARKS / DEBIT NOTE NOTES
            </label>
            <input
              type="text"
              className="input-glass"
              placeholder="e.g. Supplier agreed credit note on batch #948..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>

          {/* Return Item Lines */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                RETURN ITEMS ({formData.items.length})
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
                const lineTotal = (item.quantityReturned || 0) * (item.unitCost || 0);
                return (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1.2fr 1fr auto',
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
                        Return Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="input-glass"
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        value={item.quantityReturned}
                        onChange={(e) => handleItemChange(index, 'quantityReturned', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        Cost ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-glass"
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        Subtotal
                      </label>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', paddingTop: '6px' }}>
                        ${lineTotal.toFixed(2)}
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

          {/* Grand Total Bar */}
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
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Total Return Value:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
              ${totalReturnVal.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSavePrn(true)}
              disabled={saving}
              title="Deducts stock immediately from inventory and marks as PROCESSED"
            >
              <CheckCircle size={15} />
              {saving ? 'Processing...' : 'Process Return to Supplier'}
            </button>
            <button
              type="button"
              className="btn btn-glass"
              style={{ flex: 1, padding: '9px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
              onClick={() => handleSavePrn(false)}
              disabled={saving}
              title="Save return note as draft"
            >
              Save Draft
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: PRN Records Table & Search */}
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
                placeholder="Search PRNs by #, supplier, warehouse, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredPrns.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="glass-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>PRN #</th>
                  <th>Supplier</th>
                  <th>Warehouse</th>
                  <th>Total Value</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading purchase returns...
                    </td>
                  </tr>
                ) : filteredPrns.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No purchase returns recorded yet. Fill the form on the left to create a return.
                    </td>
                  </tr>
                ) : (
                  filteredPrns.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => handleInspectPrn(p.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to view return details"
                    >
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
                      <td style={{ fontSize: '0.8rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.reason}
                      </td>
                      <td>
                        {p.status === 'PROCESSED' ? (
                          <span className="badge badge-success">Processed</span>
                        ) : p.status === 'DRAFT' || p.status === 'PENDING' ? (
                          <span className="badge badge-warning">{p.status}</span>
                        ) : (
                          <span className="badge badge-danger">{p.status}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.status !== 'PROCESSED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessPrn(p.id, p.prnNumber);
                            }}
                            title="Process Return"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <CheckCircle size={13} /> Process
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

      {/* PRN Inspection Drawer / Modal */}
      {selectedPrn && (
        <div className="modal-backdrop" onClick={() => setSelectedPrn(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '1020px', padding: '30px', background: '#ffffff', borderRadius: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Purchase Return Details
                </span>
                <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#2563eb" /> {selectedPrn.prnNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPrn(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>SUPPLIER</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedPrn.supplierName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>WAREHOUSE</div>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedPrn.warehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>STATUS & DATE</div>
                <div>
                  <span className={`badge ${selectedPrn.status === 'PROCESSED' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedPrn.status}
                  </span>{' '}
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    {selectedPrn.createdAt ? new Date(selectedPrn.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>TOTAL VALUE</div>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                  ${Number(selectedPrn.totalAmount || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#475569' }}>
              <div><span style={{ fontWeight: 600 }}>Return Reason:</span> {selectedPrn.reason}</div>
              {selectedPrn.originalGrnNumber && (
                <div><span style={{ fontWeight: 600 }}>Original GRN #:</span> {selectedPrn.originalGrnNumber}</div>
              )}
              {selectedPrn.remarks && (
                <div><span style={{ fontWeight: 600 }}>Remarks:</span> {selectedPrn.remarks}</div>
              )}
            </div>

            <h3 style={{ fontSize: '0.95rem', color: '#0f172a', marginBottom: '8px' }}>Returned Item Lines</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrn.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.quantityReturned}</td>
                      <td style={{ textAlign: 'right' }}>${Number(it.unitCost || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ${((it.quantityReturned || 0) * (it.unitCost || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-glass" onClick={() => setSelectedPrn(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
