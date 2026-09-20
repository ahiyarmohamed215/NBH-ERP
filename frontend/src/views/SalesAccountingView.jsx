import React, { useState, useEffect } from 'react';
import { salesApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Users,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  Receipt,
  FileText,
  DollarSign,
  Printer,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  PlayCircle,
  Trash2,
  Eye
} from 'lucide-react';

export default function SalesAccountingView() {
  const { addToast } = useToast();

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [datePreset, setDatePreset] = useState('all'); // 'today' | 'month' | 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data states
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer / Inspection state
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [cashierInvoices, setCashierInvoices] = useState([]);
  const [cashierHeld, setCashierHeld] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('invoices'); // 'invoices' | 'held'

  useEffect(() => {
    loadAccountingData();
  }, [startDate, endDate]);

  const handlePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setStartDate(firstOfMonthStr);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const loadAccountingData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await salesApi.getCashierAccounting(params);
      setCashiers(res.data || []);
    } catch (err) {
      addToast('Failed to load cashier accounting: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCashierDetails = async (cashier) => {
    setSelectedCashier(cashier);
    setActiveDetailTab('invoices');
    try {
      setDetailLoading(true);
      const [invRes, heldRes] = await Promise.all([
        salesApi.search({ cashier: cashier.username, size: 50 }),
        salesApi.getHeld(cashier.username),
      ]);
      setCashierInvoices(invRes.data?.content || []);
      setCashierHeld(heldRes.data || []);
    } catch (err) {
      addToast('Failed to load cashier activity: ' + err.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDiscardHeld = async (heldId, invoiceNumber) => {
    if (!window.confirm(`Discard held bill ${invoiceNumber}?`)) return;
    try {
      await salesApi.cancelHeld(heldId);
      addToast(`Held bill ${invoiceNumber} discarded`, 'info');
      // refresh inspection
      if (selectedCashier) {
        const heldRes = await salesApi.getHeld(selectedCashier.username);
        setCashierHeld(heldRes.data || []);
      }
      loadAccountingData();
    } catch (err) {
      addToast('Failed to discard held bill: ' + err.message, 'error');
    }
  };

  // Aggregated KPIs
  const totalSales = cashiers.reduce((acc, c) => acc + (Number(c.totalSalesAmount) || 0), 0);
  const totalInvoices = cashiers.reduce((acc, c) => acc + (Number(c.completedInvoicesCount) || 0), 0);
  const totalHeldCarts = cashiers.reduce((acc, c) => acc + (Number(c.heldInvoicesCount) || 0), 0);
  const totalHeldValue = cashiers.reduce((acc, c) => acc + (Number(c.totalHeldAmount) || 0), 0);

  // Filtered Cashiers list
  const filteredCashiers = cashiers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.username?.toLowerCase().includes(q) ||
      c.fullName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header with Filters */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
            User Sales Accounting & Cashier Audit
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
            Inspect individual salesperson accounts, track billed volume, and monitor suspended carts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                border: 'none',
                background: datePreset === 'today' ? '#2563eb' : '#ffffff',
                color: datePreset === 'today' ? '#ffffff' : '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('month')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                border: 'none',
                borderLeft: '1px solid #e2e8f0',
                borderRight: '1px solid #e2e8f0',
                background: datePreset === 'month' ? '#2563eb' : '#ffffff',
                color: datePreset === 'month' ? '#ffffff' : '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset('all')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                border: 'none',
                background: datePreset === 'all' ? '#2563eb' : '#ffffff',
                color: datePreset === 'all' ? '#ffffff' : '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Time
            </button>
          </div>

          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              className="input-glass"
              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '130px' }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              className="input-glass"
              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '130px' }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
            />
          </div>

          <button
            className="btn btn-glass"
            style={{ height: '36px', padding: '0 12px' }}
            onClick={loadAccountingData}
            title="Refresh statistics"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>CASHIERS / BILLING USERS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{cashiers.length}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL COMPLETED SALES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>
              Rs. {totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={22} color="#475569" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>INVOICES BILLED</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{totalInvoices}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>ACTIVE HELD BILLS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706' }}>
              {totalHeldCarts} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#b45309' }}>(Rs. {totalHeldValue.toFixed(2)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Cashier Accounting Table */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
            Cashier Performance & Session Ledger
          </h3>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="input-glass"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
              placeholder="Search cashier name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 14px' }}>Cashier / Salesperson</th>
                <th style={{ padding: '12px 14px' }}>Roles Assigned</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Completed Invoices</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Revenue</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Active Held Carts</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Suspended Amount</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Last Sale</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                    Loading cashier ledger...
                  </td>
                </tr>
              ) : filteredCashiers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                    No cashier accounting records found.
                  </td>
                </tr>
              ) : (
                filteredCashiers.map((c) => (
                  <tr
                    key={c.username}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                    onClick={() => openCashierDetails(c)}
                  >
                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.fullName || c.username}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>@{c.username}</div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(c.roles || []).map((r) => (
                          <span
                            key={r}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: r.includes('ADMIN') ? '#fef3c7' : '#e0e7ff',
                              color: r.includes('ADMIN') ? '#92400e' : '#3730a3',
                              fontWeight: 600,
                            }}
                          >
                            {r.replace('ROLE_', '')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 600 }}>
                      {c.completedInvoicesCount}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      Rs. {Number(c.totalSalesAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center' }}>
                      {c.heldInvoicesCount > 0 ? (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: '#fef3c7',
                            color: '#b45309',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {c.heldInvoicesCount} waiting
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', color: c.heldInvoicesCount > 0 ? '#b45309' : '#94a3b8' }}>
                      Rs. {Number(c.totalHeldAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      {c.lastSaleDate || 'No sales yet'}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        className="btn btn-glass btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCashierDetails(c);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                      >
                        <Eye size={13} /> View Activity
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cashier Activity Inspection Modal / Drawer */}
      {selectedCashier && (
        <div className="modal-backdrop">
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1060px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '30px',
              borderRadius: '14px',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '16px',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    {selectedCashier.fullName}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    @{selectedCashier.username}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Cashier audit ledger • Total billed: <strong>Rs. {Number(selectedCashier.totalSalesAmount).toFixed(2)}</strong> ({selectedCashier.completedInvoicesCount} invoices)
                </div>
              </div>
              <button
                onClick={() => setSelectedCashier(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Sub-tabs: Invoices vs Held Carts */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveDetailTab('invoices')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: activeDetailTab === 'invoices' ? '#2563eb' : '#e2e8f0',
                  background: activeDetailTab === 'invoices' ? '#eff6ff' : '#ffffff',
                  color: activeDetailTab === 'invoices' ? '#1d4ed8' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Receipt size={16} /> Completed Invoices ({cashierInvoices.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDetailTab('held')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: activeDetailTab === 'held' ? '#f59e0b' : '#e2e8f0',
                  background: activeDetailTab === 'held' ? '#fffbeb' : '#ffffff',
                  color: activeDetailTab === 'held' ? '#b45309' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={16} /> Active Held Bills ({cashierHeld.length})
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  Loading cashier transactions...
                </div>
              ) : activeDetailTab === 'invoices' ? (
                cashierInvoices.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                    No completed sales invoices found for this cashier.
                  </p>
                ) : (
                  <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px' }}>Invoice #</th>
                        <th style={{ padding: '8px 10px' }}>Customer</th>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Items</th>
                        <th style={{ padding: '8px 10px' }}>Payment</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total (Rs.)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashierInvoices.map((inv) => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.82rem' }}>
                          <td style={{ padding: '10px', fontWeight: 600, color: '#2563eb' }}>
                            {inv.invoiceNumber}
                          </td>
                          <td style={{ padding: '10px' }}>{inv.customerName}</td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{inv.invoiceDate}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{inv.items?.length || 0}</td>
                          <td style={{ padding: '10px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: inv.paymentType === 'CASH' ? '#ecfdf5' : '#eff6ff',
                                color: inv.paymentType === 'CASH' ? '#047857' : '#1d4ed8',
                                fontWeight: 600,
                              }}
                            >
                              {inv.paymentType}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            Rs. {Number(inv.netTotal).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <a
                              href={pdfApi.getInvoicePdfUrl(inv.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-glass btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Printer size={13} /> Print
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                /* Held Carts Tab */
                cashierHeld.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                    This cashier currently has no bills on hold.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cashierHeld.map((held) => (
                      <div
                        key={held.id}
                        className="glass-card"
                        style={{
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{held.invoiceNumber}</span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 600,
                              }}
                            >
                              HELD
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Customer: {held.customerName} | {held.items?.length || 0} items | Date: {held.invoiceDate}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                            Rs. {Number(held.netTotal).toFixed(2)}
                          </span>
                          <button
                            className="btn btn-glass btn-sm"
                            title="Discard this held bill"
                            onClick={() => handleDiscardHeld(held.id, held.invoiceNumber)}
                            style={{ color: '#ef4444', padding: '6px 10px' }}
                          >
                            <Trash2 size={14} /> Discard
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-glass" onClick={() => setSelectedCashier(null)}>
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
