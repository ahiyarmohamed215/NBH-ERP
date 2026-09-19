import React, { useState, useEffect } from 'react';
import { reportApi, warehouseApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  BarChart3,
  Download,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  RefreshCw,
  PieChart
} from 'lucide-react';

export default function ReportsView() {
  const [activeReport, setActiveReport] = useState('sales'); // 'sales' | 'inventory'
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  
  // Sales Report state
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [salesSummary, setSalesSummary] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);

  // Inventory Valuation state
  const [valuationData, setValuationData] = useState([]);
  const [valuationLoading, setValuationLoading] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (activeReport === 'sales') {
      loadSalesSummary();
    } else {
      loadInventoryValuation();
    }
  }, [activeReport, selectedWarehouse]);

  const loadWarehouses = async () => {
    try {
      const res = await warehouseApi.getActive();
      setWarehouses(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSalesSummary = async () => {
    try {
      setSalesLoading(true);
      const res = await reportApi.getSalesSummary(startDate, endDate);
      setSalesSummary(res.data);
    } catch (err) {
      addToast('Failed to load sales report: ' + err.message, 'error');
    } finally {
      setSalesLoading(false);
    }
  };

  const loadInventoryValuation = async () => {
    try {
      setValuationLoading(true);
      const res = await reportApi.getInventoryValuation(selectedWarehouse || null);
      setValuationData(res.data || []);
    } catch (err) {
      addToast('Failed to load valuation report: ' + err.message, 'error');
    } finally {
      setValuationLoading(false);
    }
  };

  const handleExportExcel = () => {
    const downloadUrl = reportApi.getExcelDownloadUrl(selectedWarehouse || null);
    const token = localStorage.getItem('nbh_token');
    // Open in new window with download or fetch as blob
    fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        addToast('Excel report downloaded successfully!', 'success');
      })
      .catch(err => {
        addToast('Failed to download Excel report: ' + err.message, 'error');
      });
  };

  const totalInventoryValue = valuationData.reduce(
    (sum, row) => sum + (row.totalValuation || 0),
    0
  );

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={28} color="#2563eb" /> Analytics & Enterprise Reports
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Periodic sales performance, inventory valuation breakdown, and Excel exports
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={activeReport === 'sales' ? loadSalesSummary : loadInventoryValuation}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-success" onClick={handleExportExcel}>
            <FileSpreadsheet size={18} /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className={`btn ${activeReport === 'sales' ? 'btn-primary' : 'btn-glass'}`}
          onClick={() => setActiveReport('sales')}
          style={{ borderRadius: '10px' }}
        >
          <Receipt size={17} /> Sales Performance Summary
        </button>
        <button
          className={`btn ${activeReport === 'inventory' ? 'btn-primary' : 'btn-glass'}`}
          onClick={() => setActiveReport('inventory')}
          style={{ borderRadius: '10px' }}
        >
          <PieChart size={17} /> Stock Valuation Report
        </button>
      </div>

      {/* REPORT 1: SALES SUMMARY */}
      {activeReport === 'sales' && (
        <>
          {/* Date Range Selector */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                START DATE
              </label>
              <input
                type="date"
                className="input-glass"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                END DATE
              </label>
              <input
                type="date"
                className="input-glass"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={loadSalesSummary} disabled={salesLoading}>
              Apply Date Filter
            </button>
          </div>

          {/* Metric KPI Cards */}
          {salesSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL REVENUE</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                  ${Number(salesSummary.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Net sales across filtered dates
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>INVOICES COUNT</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {salesSummary.invoiceCount || 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Total finalized POS transactions
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL TAX COLLECTED</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                  ${Number(salesSummary.totalTax || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Applicable VAT/sales tax
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>DISCOUNTS GIVEN</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                  ${Number(salesSummary.totalDiscount || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Promotional / manual bill discounts
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* REPORT 2: INVENTORY VALUATION */}
      {activeReport === 'inventory' && (
        <>
          {/* Warehouse selector */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={18} color="#64748b" />
              <select
                className="input-glass"
                style={{ width: '240px', padding: '8px 12px' }}
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">All Warehouses Combined</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginRight: '10px' }}>
                TOTAL VALUATION ASSET:
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                ${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Product / SKU</th>
                    <th>Warehouse</th>
                    <th>On-Hand Quantity</th>
                    <th>Unit Cost Price</th>
                    <th>Total Asset Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationLoading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        Calculating weighted inventory valuation...
                      </td>
                    </tr>
                  ) : valuationData.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No inventory data available for valuation.
                      </td>
                    </tr>
                  ) : (
                    valuationData.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.productName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontFamily: 'monospace' }}>
                            {row.productSku}
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{row.warehouseName}</td>
                        <td style={{ fontWeight: 700 }}>{row.quantity}</td>
                        <td>${Number(row.costPrice || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          ${Number(row.totalValuation || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
