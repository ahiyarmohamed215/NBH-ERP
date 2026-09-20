import React, { useState, useEffect } from 'react';
import { salesReturnApi, salesApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Undo2,
  Plus,
  Search,
  CheckCircle,
  Receipt,
  Trash2,
  RefreshCw,
  RotateCcw,
  Eye,
  X,
  Package,
} from 'lucide-react';

export default function SalesReturnsView() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Split-view Left Panel State
  const [invoiceLookup, setInvoiceLookup] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [formData, setFormData] = useState({
    invoiceId: null,
    reason: 'Customer return / exchange',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing return
  const [selectedReturn, setSelectedReturn] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setInvoiceLookup('');
    setMatchedInvoice(null);
    setFormData({
      invoiceId: null,
      reason: 'Customer return / exchange',
      remarks: '',
      items: [],
    });
  };

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
    if (!invoiceLookup.trim()) {
      addToast('Please enter an invoice number to lookup', 'warning');
      return;
    }
    try {
      setLookingUp(true);
      const res = await salesApi.getByNumber(invoiceLookup.trim());
      const inv = res.data;
      if (!inv) {
        addToast('Invoice not found: ' + invoiceLookup, 'error');
        return;
      }
      setMatchedInvoice(inv);
      setFormData({
        invoiceId: inv.id,
        reason: 'Customer return / exchange',
        remarks: '',
        items:
          inv.items?.map((it) => ({
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
      addToast(`Loaded invoice ${inv.invoiceNumber} with ${inv.items?.length || 0} items`, 'success');
    } catch (err) {
      addToast('Invoice lookup failed: ' + err.message, 'error');
    } finally {
      setLookingUp(false);
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
      addToast('Specify a return quantity greater than 0 for at least one item', 'error');
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
      resetForm();
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to process return', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInspectReturn = async (id) => {
    try {
      const res = await salesReturnApi.getById(id);
      setSelectedReturn(res.data);
    } catch (err) {
      addToast('Failed to load return details: ' + err.message, 'error');
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

  const totalCredit = calculateReturnTotal();

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Undo2 size={26} color="#2563eb" /> Customer Sales Returns & Credit Notes
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Process invoice returns, credit notes, and restock inventory directly on the left while monitoring return logs on the right
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
        {/* LEFT PANEL: Sales Return Form */}
        <div
          className="glass-card"
          style={{
            flex: '1 1 460px',
            maxWidth: '560px',
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
                Process Customer Return
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-glass btn-sm"
              onClick={resetForm}
              title="Reset fields"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          {/* Invoice Lookup Row */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              SEARCH ORIGINAL INVOICE NUMBER *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-glass"
                placeholder="e.g. INV-2026-0001"
                value={invoiceLookup}
                onChange={(e) => setInvoiceLookup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookupInvoice();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLookupInvoice}
                disabled={lookingUp}
                style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '0.82rem' }}
              >
                <Receipt size={15} /> {lookingUp ? 'Finding...' : 'Lookup'}
              </button>
            </div>
          </div>

          {matchedInvoice ? (
            <>
              {/* Matched Invoice Badge */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.9rem' }}>
                    Invoice {matchedInvoice.invoiceNumber}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                    Customer: {matchedInvoice.customerName || 'Walk-in'} | Total: ${Number(matchedInvoice.grandTotal || 0).toFixed(2)}
                  </div>
                </div>
                <span className="badge badge-success">Verified</span>
              </div>

              {/* Items Return Table */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  INVOICE ITEMS TO RETURN
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '230px', overflowY: 'auto' }}>
                  {formData.items.map((item, idx) => {
                    const lineRefund = (item.quantityReturned || 0) * (item.unitPrice || 0);
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                              {item.productName}
                            </span>{' '}
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                              ({item.sku})
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Sold: <strong>{item.maxQty}</strong> @ ${Number(item.unitPrice || 0).toFixed(2)}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '8px', alignItems: 'center' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                              Return Qty (Max {item.maxQty})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.maxQty}
                              className="input-glass"
                              style={{ padding: '4px 8px', fontSize: '0.82rem', textAlign: 'center' }}
                              value={item.quantityReturned}
                              onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                            />
                          </div>

                          <div style={{ paddingTop: '14px' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                              <input
                                type="checkbox"
                                checked={item.restockable}
                                onChange={() => handleRestockableToggle(idx)}
                              />
                              {item.restockable ? (
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Restock to Inventory</span>
                              ) : (
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>Damaged / Scrap</span>
                              )}
                            </label>
                          </div>

                          <div style={{ textAlign: 'right', paddingTop: '14px' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: lineRefund > 0 ? '#dc2626' : '#94a3b8' }}>
                              ${lineRefund.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reason & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    RETURN REASON
                  </label>
                  <input
                    type="text"
                    className="input-glass"
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
                    placeholder="Customer notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>

              {/* Grand Total Credit Bar */}
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
                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Total Credit Refund:</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>
                  ${totalCredit.toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '10px 14px', fontSize: '0.88rem', justifyContent: 'center' }}
                onClick={handleSaveReturn}
                disabled={saving || totalCredit <= 0}
              >
                <CheckCircle size={16} />
                {saving ? 'Processing...' : 'Issue Credit Note & Process Return'}
              </button>
            </>
          ) : (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Receipt size={32} color="#94a3b8" />
              <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                Lookup an Invoice to Begin
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '320px' }}>
                Enter the original sales invoice number above to inspect sold items and select which ones to return or restock.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Sales Returns Records Table & Search */}
        <div
          className="glass-card"
          style={{
            flex: '1 1 520px',
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
                placeholder="Search returns by return #, invoice #, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredReturns.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="glass-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Original Invoice</th>
                  <th>Credit Note</th>
                  <th>Customer</th>
                  <th>Refund Amount</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading customer returns...
                    </td>
                  </tr>
                ) : filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No sales returns recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => handleInspectReturn(r.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to view return details"
                    >
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
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reason}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem' }}>
                        View Details
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
      {selectedReturn && (
        <div className="modal-backdrop" onClick={() => setSelectedReturn(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '1020px', padding: '30px', background: '#ffffff', borderRadius: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Sales Return Details
                </span>
                <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#2563eb" /> {selectedReturn.returnNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>ORIGINAL INVOICE</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedReturn.invoiceNumber}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>CREDIT NOTE #</div>
                <div style={{ fontWeight: 600, color: '#d97706' }}>{selectedReturn.creditNoteNumber || '—'}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>CUSTOMER</div>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedReturn.customerName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>TOTAL REFUND</div>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                  ${Number(selectedReturn.totalRefundAmount || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#475569' }}>
              <div><span style={{ fontWeight: 600 }}>Reason:</span> {selectedReturn.reason}</div>
              {selectedReturn.remarks && (
                <div><span style={{ fontWeight: 600 }}>Remarks:</span> {selectedReturn.remarks}</div>
              )}
            </div>

            <h3 style={{ fontSize: '0.95rem', color: '#0f172a', marginBottom: '8px' }}>Returned Items</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th>Restocked?</th>
                    <th style={{ textAlign: 'right' }}>Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturn.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.quantityReturned}</td>
                      <td style={{ textAlign: 'right' }}>${Number(it.unitPrice || 0).toFixed(2)}</td>
                      <td>
                        {it.restockable ? (
                          <span className="badge badge-success">Restocked</span>
                        ) : (
                          <span className="badge badge-danger">Scrapped</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        ${((it.quantityReturned || 0) * (it.unitPrice || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-glass" onClick={() => setSelectedReturn(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
