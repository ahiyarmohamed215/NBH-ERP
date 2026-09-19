import React, { useState, useEffect } from 'react';
import { dashboardApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Clock,
  Printer,
  PlusCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getSummary();
      setData(res.data);
    } catch (err) {
      addToast('Failed to load dashboard metrics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
        <p>Loading real-time enterprise metrics...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '4px' }}>Executive Overview</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Real-time inventory valuation & warehouse operations monitor</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('pos')}>
            <ShoppingCart size={18} /> Open POS Terminal
          </button>
          <button className="btn btn-glass" onClick={() => onNavigate('grn')}>
            <PlusCircle size={18} /> Receive GRN
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '20px'
      }}>
        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>TODAY'S REVENUE</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            Rs. {Number(data.todaySales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
            {data.todayOrders} completed invoices
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>INVENTORY VALUATION</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Boxes size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            Rs. {Number(data.totalInventoryValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            Enterprise cost asset value
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>LOW STOCK ALERTS</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: data.lowStockCount > 0 ? '#dc2626' : '#0f172a', fontFamily: 'var(--font-heading)' }}>
            {data.lowStockCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: data.lowStockCount > 0 ? '#b91c1c' : '#10b981', marginTop: '6px', fontWeight: 600 }}>
            {data.lowStockCount > 0 ? 'Items below reorder limit' : 'All stock levels healthy'}
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>HELD POS CARTS</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            {data.heldInvoicesCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            Awaiting customer resume
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Sales & Recent GRNs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Recent Invoices */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a' }}>Recent Sales Invoices</h3>
            <button className="btn btn-glass btn-sm" onClick={() => onNavigate('sales')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          <table className="glass-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices?.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No sales recorded yet</td>
                </tr>
              ) : (
                data.recentInvoices?.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: '#2563eb' }}>{inv.invoiceNumber}</td>
                    <td>{inv.customerName}</td>
                    <td style={{ fontWeight: 700 }}>Rs. {Number(inv.netTotal).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${inv.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <a
                        href={pdfApi.getInvoicePdfUrl(inv.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-glass btn-sm"
                        title="Print Invoice PDF"
                      >
                        <Printer size={14} /> Print
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Recent GRN Receipts */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a' }}>Recent Stock Receipts (GRN)</h3>
            <button className="btn btn-glass btn-sm" onClick={() => onNavigate('grn')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          <table className="glass-table">
            <thead>
              <tr>
                <th>GRN #</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.recentGrns?.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No goods received yet</td>
                </tr>
              ) : (
                data.recentGrns?.map((grn) => (
                  <tr key={grn.id}>
                    <td style={{ fontWeight: 600, color: '#0d9488' }}>{grn.grnNumber}</td>
                    <td>{grn.supplierName}</td>
                    <td>{grn.warehouseName}</td>
                    <td>
                      <span className={`badge ${grn.status === 'PROCESSED' ? 'badge-success' : 'badge-info'}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td>
                      <a
                        href={pdfApi.getGrnPdfUrl(grn.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-glass btn-sm"
                        title="Print GRN PDF"
                      >
                        <Printer size={14} /> Print
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
