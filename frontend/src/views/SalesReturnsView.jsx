import React, { useState, useEffect } from 'react';
import { salesReturnApi, salesApi, productApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Undo2,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  Receipt,
  Trash2
} from 'lucide-react';

export default function SalesReturnsView() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceLookup, setInvoiceLookup] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    invoiceId: null,
    reason: 'Customer exchange / return',
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
      const res = await salesReturnApi.search({ size: 100 });
      setReturns(res.data?.content || res.data || []);
    } catch (err) {
      addToast('Failed to load sales returns: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupInvoice = async () => {
    if (!invoiceLookup.trim()) return;
    try {
      const res = await salesApi.getByNumber(invoiceLookup.trim());
      const inv = res.data;
      if (!inv) {
        addToast('Invoice not found: ' + invoiceLookup, 'error');
        return;
      }
      setMatchedInvoice(inv);
      setFormData({
        invoiceId: inv.id,
        reason: 'Customer return',
        remarks: '',
        items: inv.items?.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.productSku,
          maxQty: it.quantity,
          quantityReturned: 0,
          unitPrice: it.unitPrice,
          restockable: true,
          reason: 'Customer return',
        })) || [],
      });
      addToast(`Loaded Invoice ${inv.invoiceNumber} with ${inv.items?.length || 0} items`, 'success');
    } catch (err) {
      addToast('Invoice lookup failed: ' + err.message, 'error');
    }
  };

  const handleItemQtyChange = (idx, qty) => {
    const updated = [...formData.items];
    const row = { ...updated[idx] };
    const parsed = parseInt(qty, 10) || 0;
    row.quantityReturned = Math.min(Math.max(0, parsed), row.maxQty);
    updated[idx] = row;
    setFormData({ ...formData, items: updated });
  };

  const handleRestockableToggle = (idx) => {
    const updated = [...formData.items];
    updated[idx] = { ...updated[idx], restockable: !updated[idx].restockable };
    setFormData({ ...formData, items: updated });
  };

  const calculateReturnTotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + (item.quantityReturned || 0) * (item.unitPrice || 0),
      0
    );
  };

  const handleSaveReturn = async () => {
    const validItems = formData.items.filter((it) => it.quantityReturned > 0);
    if (!formData.invoiceId || validItems.length === 0) {
      addToast('Please specify return quantities for at least one invoice item', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        invoiceId: Number(formData.invoiceId),
        reason: formData.reason,
        remarks: formData.remarks.trim() || null,
        items: validItems.map((it) => ({
          productId: Number(it.productId),
          quantityReturned: Number(it.quantityReturned),
          unitPrice: Number(it.unitPrice),
          restockable: Boolean(it.restockable),
          reason: it.reason,
        })),
      };

      const res = await salesReturnApi.create(payload);
      addToast(
        `Sales Return ${res.data?.returnNumber || ''} created! Credit Note ${res.data?.creditNoteNumber || ''} issued.`,
        'success'
      );
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to process return', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredReturns = returns.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.returnNumber?.toLowerCase().includes(q) ||
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.creditNoteNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Undo2 size={28} color="#2563eb" /> Customer Sales Returns & Credit Notes
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Process invoice returns, credit notes, and restockable inventory re-entry
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setMatchedInvoice(null);
              setInvoiceLookup('');
              setFormData({
                invoiceId: null,
                reason: 'Customer exchange / return',
                remarks: '',
                items: [],
              });
              setShowModal(true);
            }}
          >
            <Plus size={18} /> Process Customer Return
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
            placeholder="Search returns by return #, invoice #, or credit note #..."
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
                <th>Return No.</th>
                <th>Original Invoice</th>
                <th>Credit Note</th>
                <th>Customer</th>
                <th>Refund Amount</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading customer returns...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No sales returns recorded yet.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        {r.returnNumber}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                        {r.invoiceNumber}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ fontFamily: 'monospace' }}>
                        {r.creditNoteNumber || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.customerName}</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>
                      ${Number(r.totalRefundAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{r.reason}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
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
                <Undo2 size={22} color="#2563eb" /> Customer Sales Return & Credit Note
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Invoice Lookup Row */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  SEARCH ORIGINAL INVOICE NUMBER
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. INV-2026-0001"
                  value={invoiceLookup}
                  onChange={(e) => setInvoiceLookup(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleLookupInvoice}>
                <Receipt size={16} /> Lookup Invoice
              </button>
            </div>

            {matchedInvoice && (
              <>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(239, 246, 255, 0.7)',
                  border: '1px solid #bfdbfe',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e40af' }}>
                      Invoice {matchedInvoice.invoiceNumber}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#3b82f6' }}>
                      Customer: {matchedInvoice.customerName} | Total: ${Number(matchedInvoice.grandTotal || 0).toFixed(2)}
                    </div>
                  </div>
                  <span className="badge badge-success">Verified</span>
                </div>

                {/* Items Return Table */}
                <div style={{ marginBottom: '18px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table className="glass-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Sold Qty</th>
                        <th>Return Qty</th>
                        <th>Unit Price</th>
                        <th>Restockable?</th>
                        <th style={{ textAlign: 'right' }}>Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const lineRefund = (item.quantityReturned || 0) * (item.unitPrice || 0);
                        return (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.productName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#2563eb', fontFamily: 'monospace' }}>
                                {item.sku}
                              </div>
                            </td>
                            <td style={{ color: '#64748b' }}>{item.maxQty}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={item.maxQty}
                                className="input-glass"
                                style={{ width: '80px', padding: '6px 8px' }}
                                value={item.quantityReturned}
                                onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                              />
                            </td>
                            <td>${Number(item.unitPrice || 0).toFixed(2)}</td>
                            <td>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input
                                  type="checkbox"
                                  checked={item.restockable}
                                  onChange={() => handleRestockableToggle(idx)}
                                />
                                {item.restockable ? 'Restock to Inventory' : 'Damaged / Scrap'}
                              </label>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                              ${lineRefund.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total and Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ flex: 1, marginRight: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      RETURN REASON
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL CREDIT REFUND</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>
                      ${calculateReturnTotal().toFixed(2)}
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
                    className="btn btn-primary"
                    onClick={handleSaveReturn}
                    disabled={saving || calculateReturnTotal() <= 0}
                  >
                    {saving ? 'Processing...' : 'Issue Credit Note & Restock'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
