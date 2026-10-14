import StatusBadge from '../components/StatusBadge';
import {useAuth} from '../context/AuthContext';
import {hasPermission} from '../utils/moduleAccess';
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
  const {user}=useAuth();
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
      addToast('Unable to load dashboard metrics. Please try again.', 'error');
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
    <div className="erp-page" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div className="erp-page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 className="erp-page-title">NBH ERP Dashboard</h1>
          <p className="erp-page-description">Real-time enterprise metrics, sales performance & inventory status</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button disabled={!hasPermission(user,'SALES_CREATE')} className="btn btn-primary erp-button" onClick={() => onNavigate('pos')}>
            <ShoppingCart size={18} /> Open POS
          </button>
          <button disabled={!hasPermission(user,'GRN_PROCESS')} className="btn btn-glass erp-button" onClick={() => onNavigate('grn')}>
            <PlusCircle size={18} /> New Goods Received
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '20px',
      }}>
        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--erp-text-small)', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>TODAY'S REVENUE</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--erp-text-title)', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            Rs. {Number(data.todaySales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--erp-text-small)', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
            {data.todayOrders} completed invoices
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--erp-text-small)', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>INVENTORY VALUATION</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Boxes size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--erp-text-title)', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            Rs. {Number(data.totalInventoryValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', marginTop: '6px' }}>
            Enterprise cost asset value
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--erp-text-small)', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>LOW STOCK ALERTS</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--erp-text-title)', fontWeight: 800, color: data.lowStockCount > 0 ? '#dc2626' : '#0f172a', fontFamily: 'var(--font-heading)' }}>
            {data.lowStockCount}
          </div>
          <div style={{ fontSize: 'var(--erp-text-small)', color: data.lowStockCount > 0 ? '#b91c1c' : '#10b981', marginTop: '6px', fontWeight: 600 }}>
            {data.lowStockCount > 0 ? 'Items below reorder limit' : 'All stock levels healthy'}
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--erp-text-small)', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>HELD POS CARTS</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--erp-text-title)', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>
            {data.heldInvoicesCount}
          </div>
          <div style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', marginTop: '6px' }}>
            Awaiting customer resume
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Sales & Recent GRNs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Recent Invoices */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: 'var(--erp-text-section)', color: '#0f172a' }}>Recent Sales Invoices</h3>
            <button className="btn btn-glass btn-sm erp-button" onClick={() => onNavigate('sales')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="erp-table-frame erp-table-scroll"><table className="glass-table erp-table">
            <thead>
              <tr>
                <th className="erp-table-heading">Invoice #</th>
                <th className="erp-table-heading">Customer</th>
                <th className="erp-table-heading">Total</th>
                <th className="erp-table-heading">Status</th>
                <th className="erp-table-heading erp-table-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices?.length === 0 ? (
                <tr>
                  <td className="erp-table-cell" colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No sales recorded yet</td>
                </tr>
              ) : (
                data.recentInvoices?.map((inv) => (
                  <tr key={inv.id}>
                    <td className="erp-table-cell erp-table-code" style={{ fontWeight: 600, color: '#2563eb' }}>{inv.invoiceNumber}</td>
                    <td className="erp-table-cell">{inv.customerName}</td>
                    <td className="erp-table-cell" style={{ fontWeight: 700 }}>Rs. {Number(inv.netTotal).toFixed(2)}</td>
                    <td className="erp-table-cell">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="erp-table-cell erp-table-actions">
                      <button aria-label="Print Invoice PDF Directly"
                        type="button"
                        onClick={() => pdfApi.printInvoice(inv.id)}
                        className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                        title="Print Invoice PDF Directly"
                      ><Printer size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>

        {/* Recent GRN Receipts */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: 'var(--erp-text-section)', color: '#0f172a' }}>Recent Stock Receipts (GRN)</h3>
            <button className="btn btn-glass btn-sm erp-button" onClick={() => onNavigate('grn')}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="erp-table-frame erp-table-scroll"><table className="glass-table erp-table">
            <thead>
              <tr>
                <th className="erp-table-heading">GRN #</th>
                <th className="erp-table-heading">Supplier</th>
                <th className="erp-table-heading">Warehouse</th>
                <th className="erp-table-heading">Status</th>
                <th className="erp-table-heading erp-table-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.recentGrns?.length === 0 ? (
                <tr>
                  <td className="erp-table-cell" colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No goods received yet</td>
                </tr>
              ) : (
                data.recentGrns?.map((grn) => (
                  <tr key={grn.id}>
                    <td className="erp-table-cell erp-table-code" style={{ fontWeight: 600, color: '#0d9488' }}>{grn.grnNumber}</td>
                    <td className="erp-table-cell">{grn.supplierName}</td>
                    <td className="erp-table-cell">{grn.warehouseName}</td>
                    <td className="erp-table-cell">
                      <StatusBadge status={grn.status} />
                    </td>
                    <td className="erp-table-cell erp-table-actions">
                      <button aria-label="Print GRN PDF Directly"
                        type="button"
                        onClick={() => pdfApi.printGrn(grn.id)}
                        className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                        title="Print GRN PDF Directly"
                      ><Printer size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
