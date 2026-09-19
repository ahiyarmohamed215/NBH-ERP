import React, { useState, useEffect } from 'react';
import { grnApi, supplierApi, warehouseApi, productApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  CheckCircle,
  XCircle,
  Trash2,
  Building2,
  RefreshCw,
  X,
  Eye
} from 'lucide-react';

export default function GrnView() {
  const [grns, setGrns] = useState([]);
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
    supplierInvoiceNumber: '',
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
      const [grnRes, supRes, whRes, prodRes] = await Promise.all([
        grnApi.search({ size: 100 }),
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 200, activeOnly: true }),
      ]);
      setGrns(grnRes.data?.content || grnRes.data || []);
      setSuppliers(supRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.content || prodRes.data || []);
    } catch (err) {
      addToast('Failed to load GRN records: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    setFormData({
      supplierId: suppliers.length > 0 ? suppliers[0].id : '',
      warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
      supplierInvoiceNumber: '',
      remarks: '',
      items: [
        {
          productId: products.length > 0 ? products[0].id : '',
          quantityReceived: 1,
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
          quantityReceived: 1,
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
    } else if (field === 'quantityReceived') {
      row.quantityReceived = parseInt(value, 10) || 0;
    } else if (field === 'unitCost') {
      row.unitCost = parseFloat(value) || 0;
    }

    updated[index] = row;
    setFormData({ ...formData, items: updated });
  };

  const calculateTotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + (item.quantityReceived || 0) * (item.unitCost || 0),
      0
    );
  };

  const handleSaveGrn = async (processImmediately = true) => {
    if (!formData.supplierId || !formData.warehouseId) {
      addToast('Please select supplier and warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to the GRN', 'error');
      return;
    }
    for (const item of formData.items) {
      if (!item.productId || item.quantityReceived <= 0) {
        addToast('Invalid product or quantity received in items list', 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        supplierId: Number(formData.supplierId),
        warehouseId: Number(formData.warehouseId),
        supplierInvoiceNumber: formData.supplierInvoiceNumber.trim() || null,
        receivedDate: new Date().toISOString().slice(0, 10),
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityReceived: Number(it.quantityReceived),
          unitCost: Number(it.unitCost),
        })),
      };

      const res = await grnApi.create(payload, processImmediately);
      addToast(
        `GRN ${res.data?.grnNumber || 'receipt'} created ${processImmediately ? 'and processed into stock!' : 'as draft.'}`,
        'success'
      );
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create GRN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessExisting = async (id, grnNumber) => {
    try {
      await grnApi.process(id);
      addToast(`GRN ${grnNumber} processed! Inventory balances updated.`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to process GRN: ' + err.message, 'error');
    }
  };

  const handlePrintPdf = (id) => {
    const url = pdfApi.getGrnPdfUrl(id);
    window.open(url, '_blank');
  };

  const filteredGrns = grns.filter((g) => {
    const q = searchTerm.toLowerCase();
    return (
      g.grnNumber?.toLowerCase().includes(q) ||
      g.supplierName?.toLowerCase().includes(q) ||
      g.warehouseName?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck size={28} color="#2563eb" /> Goods Received Notes (GRN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Inward inventory intake workflow — updates stock balances & weighted average cost
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} /> New GRN Intake
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder="Search GRNs by number, supplier, or warehouse..."
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
                <th>GRN Number</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading goods received notes...
                  </td>
                </tr>
              ) : filteredGrns.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No GRN documents recorded yet. Click "New GRN Intake" to receive stock.
                  </td>
                </tr>
              ) : (
                filteredGrns.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        {g.grnNumber}
                      </span>
                      {g.supplierInvoiceNumber && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Inv: {g.supplierInvoiceNumber}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{g.supplierName}</td>
                    <td>{g.warehouseName}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      ${Number(g.totalAmount || 0).toFixed(2)}
                    </td>
                    <td>
                      {g.status === 'PROCESSED' ? (
                        <span className="badge badge-success">Processed</span>
                      ) : g.status === 'DRAFT' ? (
                        <span className="badge badge-warning">Draft</span>
                      ) : (
                        <span className="badge badge-danger">Cancelled</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {g.status === 'DRAFT' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleProcessExisting(g.id, g.grnNumber)}
                            title="Process and update inventory balances"
                          >
                            <CheckCircle size={14} /> Process
                          </button>
                        )}
                        <button
                          className="btn btn-glass btn-sm"
                          onClick={() => handlePrintPdf(g.id)}
                          title="Print / View Official GRN PDF"
                        >
                          <Printer size={14} /> PDF
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

      {/* New GRN Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '820px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck size={22} color="#2563eb" /> Inward Goods Received Note (GRN)
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warehouse & Supplier Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  DESTINATION WAREHOUSE *
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  SUPPLIER INVOICE REF
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. SUP-INV-994"
                  value={formData.supplierInvoiceNumber}
                  onChange={(e) => setFormData({ ...formData, supplierInvoiceNumber: e.target.value })}
                />
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>LINE ITEMS RECEIVED</span>
                <button type="button" className="btn btn-glass btn-sm" onClick={handleAddItem}>
                  <Plus size={14} /> Add Item Row
                </button>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Product</th>
                      <th style={{ width: '20%' }}>Quantity Received</th>
                      <th style={{ width: '20%' }}>Unit Cost ($)</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => {
                      const lineTotal = (item.quantityReceived || 0) * (item.unitCost || 0);
                      return (
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
                              value={item.quantityReceived}
                              onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)}
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
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            ${lineTotal.toFixed(2)}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks & Live Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  REMARKS / NOTES
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="Optional delivery notes, batch comments..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
              <div style={{ textAlign: 'right', minWidth: '180px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL INTAKE VALUATION</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
                  ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>

            {/* Actions */}
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
                className="btn btn-glass"
                onClick={() => handleSaveGrn(false)}
                disabled={saving}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSaveGrn(true)}
                disabled={saving}
              >
                {saving ? 'Processing...' : 'Save & Receive Stock Into Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
