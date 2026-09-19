import React, { useState, useEffect } from 'react';
import { inventoryApi, warehouseApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Boxes,
  Layers,
  FileText,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  AlertTriangle,
  Building2
} from 'lucide-react';

export default function InventoryView({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' | 'ledger'
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  
  // Stock Balances State
  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balanceSearch, setBalanceSearch] = useState('');

  // Stock Ledger State
  const [ledgerMovements, setLedgerMovements] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const { addToast } = useToast();

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === 'balances') {
      loadBalances();
    } else {
      loadLedger();
    }
  }, [activeTab, selectedWarehouse, movementTypeFilter]);

  const loadWarehouses = async () => {
    try {
      const res = await warehouseApi.getActive();
      setWarehouses(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBalances = async () => {
    try {
      setBalancesLoading(true);
      const params = { size: 150 };
      if (selectedWarehouse) params.warehouseId = selectedWarehouse;
      const res = await inventoryApi.getBalances(params);
      setBalances(res.data?.content || res.data || []);
    } catch (err) {
      addToast('Failed to load stock balances: ' + err.message, 'error');
    } finally {
      setBalancesLoading(false);
    }
  };

  const loadLedger = async () => {
    try {
      setLedgerLoading(true);
      const params = { size: 100 };
      if (selectedWarehouse) params.warehouseId = selectedWarehouse;
      if (movementTypeFilter) params.movementType = movementTypeFilter;
      const res = await inventoryApi.getLedger(params);
      setLedgerMovements(res.data?.content || res.data || []);
    } catch (err) {
      addToast('Failed to load stock ledger: ' + err.message, 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const filteredBalances = balances.filter((b) => {
    const q = balanceSearch.toLowerCase();
    return (
      b.productName?.toLowerCase().includes(q) ||
      b.productSku?.toLowerCase().includes(q) ||
      b.warehouseName?.toLowerCase().includes(q)
    );
  });

  const filteredLedger = ledgerMovements.filter((m) => {
    const q = ledgerSearch.toLowerCase();
    return (
      m.productName?.toLowerCase().includes(q) ||
      m.productSku?.toLowerCase().includes(q) ||
      m.referenceNumber?.toLowerCase().includes(q) ||
      m.remarks?.toLowerCase().includes(q)
    );
  });

  const totalValuation = balances.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.costPrice || 0),
    0
  );

  const totalUnits = balances.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const renderMovementBadge = (type) => {
    if (type?.includes('IN')) {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <TrendingUp size={12} /> {type}
        </span>
      );
    }
    if (type?.includes('OUT')) {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <TrendingDown size={12} /> {type}
        </span>
      );
    }
    return (
      <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <ArrowRightLeft size={12} /> {type}
      </span>
    );
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Boxes size={28} color="#2563eb" /> Central Stock Engine & Ledger
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Real-time multi-warehouse stock balances and immutable audit movement ledger
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-glass"
            onClick={activeTab === 'balances' ? loadBalances : loadLedger}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs and Quick Warehouse Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('balances')}
            style={{ borderRadius: '10px' }}
          >
            <Layers size={17} /> Real-Time Balances
          </button>
          <button
            className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('ledger')}
            style={{ borderRadius: '10px' }}
          >
            <FileText size={17} /> Stock Ledger (Audit Trail)
          </button>
        </div>

        {/* Warehouse Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={18} color="#64748b" />
          <select
            className="input-glass"
            style={{ width: '220px', padding: '8px 12px' }}
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: REAL TIME BALANCES */}
      {activeTab === 'balances' && (
        <>
          {/* Summary Mini Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL VALUATION</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>ON-HAND QUANTITY</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                {totalUnits.toLocaleString()} units
              </div>
            </div>
            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>MONITORED SKUs</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                {balances.length} records
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="glass-card" style={{ padding: '14px 20px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '42px' }}
                placeholder="Filter by product name, SKU, or warehouse..."
                value={balanceSearch}
                onChange={(e) => setBalanceSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Product / SKU</th>
                    <th>On-Hand Qty</th>
                    <th>Reserved</th>
                    <th>Available Qty</th>
                    <th>Cost Price</th>
                    <th>Valuation</th>
                    <th>Stock Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {balancesLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        Loading stock balance records...
                      </td>
                    </tr>
                  ) : filteredBalances.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No stock records found. Receive inventory via GRN to build stock balances.
                      </td>
                    </tr>
                  ) : (
                    filteredBalances.map((b) => {
                      const available = (b.quantity || 0) - (b.reservedQuantity || 0);
                      const isLow = available <= (b.minStockLevel || 5);
                      const itemVal = (b.quantity || 0) * (b.costPrice || 0);

                      return (
                        <tr key={b.id || `${b.warehouseId}-${b.productId}`}>
                          <td style={{ fontWeight: 600, color: '#334155' }}>
                            {b.warehouseName}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.productName}</div>
                            <div style={{ fontSize: '0.78rem', color: '#2563eb', fontFamily: 'monospace' }}>
                              {b.productSku}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {b.quantity}
                          </td>
                          <td style={{ color: '#64748b' }}>{b.reservedQuantity || 0}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: available <= 0 ? '#ef4444' : '#059669' }}>
                              {available}
                            </span>
                          </td>
                          <td style={{ color: '#64748b' }}>${Number(b.costPrice || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            ${itemVal.toFixed(2)}
                          </td>
                          <td>
                            {isLow ? (
                              <span className="badge badge-warning">
                                <AlertTriangle size={12} /> Low Stock (Min: {b.minStockLevel || 5})
                              </span>
                            ) : (
                              <span className="badge badge-success">Optimal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: CENTRAL STOCK LEDGER */}
      {activeTab === 'ledger' && (
        <>
          {/* Filter Bar */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '42px' }}
                placeholder="Search by SKU, product, reference number (e.g. GRN-, INV-)..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>TYPE:</span>
              <select
                className="input-glass"
                style={{ width: '180px', padding: '8px 12px' }}
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
              >
                <option value="">All Movement Types</option>
                <option value="IN">IN (GRN / Intake)</option>
                <option value="OUT">OUT (Sale / POS)</option>
                <option value="TRANSFER_IN">TRANSFER_IN</option>
                <option value="TRANSFER_OUT">TRANSFER_OUT</option>
                <option value="ADJUSTMENT_IN">ADJUSTMENT_IN</option>
                <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option>
                <option value="RETURN_IN">RETURN_IN</option>
                <option value="RETURN_OUT">RETURN_OUT</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Movement Type</th>
                    <th>Warehouse</th>
                    <th>Product / SKU</th>
                    <th>Quantity Change</th>
                    <th>Balance After</th>
                    <th>Reference Document</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        Loading immutable ledger movements...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No ledger transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((m) => {
                      const isPositive = m.quantity > 0;
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}
                          </td>
                          <td>{renderMovementBadge(m.movementType)}</td>
                          <td style={{ fontWeight: 500 }}>{m.warehouseName}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.productName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#2563eb', fontFamily: 'monospace' }}>
                              {m.productSku}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: isPositive ? '#059669' : '#dc2626',
                              }}
                            >
                              {isPositive ? `+${m.quantity}` : m.quantity}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            {m.balanceAfter !== undefined ? m.balanceAfter : '—'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                              {m.referenceNumber || '—'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            {m.remarks || '—'}
                          </td>
                        </tr>
                      );
                    })
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
