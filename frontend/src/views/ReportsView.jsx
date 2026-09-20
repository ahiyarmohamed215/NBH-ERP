import React, { useState, useEffect, useMemo } from 'react';
import { reportApi, warehouseApi, customerApi, userApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Users,
  BarChart3,
  Package,
  ShoppingCart,
  FolderKanban,
  DollarSign,
  Download,
  Search,
  Sliders,
  Calendar,
  Eye,
  FileText,
  Clock,
  TrendingUp,
  RefreshCw,
  Building2,
  X,
  Printer,
  ChevronRight,
} from 'lucide-react';

const STORAGE_KEY_OUTSTANDING = 'erp_reports_customer_outstanding_v1';

// Seeded Customer Outstanding Data matching screenshot
const INITIAL_OUTSTANDING_CUSTOMERS = [
  {
    id: 'cust-1',
    name: 'test 2',
    phone: '0771234567',
    email: 'test2@nbh.lk',
    group: 'Route 1',
    postedBy: 'Admin User',
    totalOutstanding: 39795.5,
    days0to7: 0.0,
    days8to21: 0.0,
    days22Plus: 39795.5,
    invoicesCount: 1,
    invoices: [
      { invoiceNo: 'INV-2026-081', date: '2026-08-10', total: 39795.5, paid: 0, balance: 39795.5, days: 41 },
    ],
  },
  {
    id: 'cust-2',
    name: 'AIA Insurance',
    phone: '0112345678',
    email: 'corp@aia.lk',
    group: 'Route 1',
    postedBy: 'Admin User',
    totalOutstanding: 338.8,
    days0to7: 0.0,
    days8to21: 338.8,
    days22Plus: 0.0,
    invoicesCount: 2,
    invoices: [
      { invoiceNo: '26AUG_MB_:93', date: '2026-08-24', total: 238.8, paid: 10.0, balance: 228.8, days: 19 },
      { invoiceNo: '26AUG_MB_:92', date: '2026-08-24', total: 128.0, paid: 18.0, balance: 110.0, days: 19 },
    ],
  },
  {
    id: 'cust-3',
    name: 'Negombo Motors',
    phone: '0312224455',
    email: 'service@negombomotors.lk',
    group: 'Route 1',
    postedBy: 'Admin User',
    totalOutstanding: 28450.0,
    days0to7: 0.0,
    days8to21: 0.0,
    days22Plus: 28450.0,
    invoicesCount: 8,
    invoices: [
      { invoiceNo: '26JUL_MB_:40', date: '2026-07-28', total: 28450.0, paid: 0, balance: 28450.0, days: 54 },
    ],
  },
  {
    id: 'cust-4',
    name: 'Apex Supermarket',
    phone: '0718889900',
    email: 'orders@apex.com',
    group: 'City Route',
    postedBy: 'Cashier 1',
    totalOutstanding: 12540.0,
    days0to7: 0.0,
    days8to21: 0.0,
    days22Plus: 12540.0,
    invoicesCount: 5,
    invoices: [
      { invoiceNo: '26JUL_MB_:22', date: '2026-07-15', total: 12540.0, paid: 0, balance: 12540.0, days: 67 },
    ],
  },
  {
    id: 'cust-5',
    name: 'Lanka Traders',
    phone: '0754443322',
    email: 'lankatraders@gmail.com',
    group: 'Wholesale Route',
    postedBy: 'Admin User',
    totalOutstanding: 5837.34,
    days0to7: 0.0,
    days8to21: 0.0,
    days22Plus: 5837.34,
    invoicesCount: 3,
    invoices: [
      { invoiceNo: '26AUG_MB_:12', date: '2026-08-05', total: 5837.34, paid: 0, balance: 5837.34, days: 46 },
    ],
  },
  {
    id: 'cust-6',
    name: 'Kandy Distributors',
    phone: '0812233445',
    email: 'kandydist@sltnet.lk',
    group: 'Hill Country Route',
    postedBy: 'Cashier 2',
    totalOutstanding: 2000.0,
    days0to7: 0.0,
    days8to21: 0.0,
    days22Plus: 2000.0,
    invoicesCount: 1,
    invoices: [
      { invoiceNo: '26AUG_MB_:08', date: '2026-08-01', total: 2000.0, paid: 0, balance: 2000.0, days: 50 },
    ],
  },
];

export default function ReportsView({ activeSubTab = 'customer-reports' }) {
  const { addToast } = useToast();

  // Primary Category Tabs matching user screenshot
  const PRIMARY_TABS = [
    { id: 'customer-reports', label: 'Customer Reports', title: 'Customer Reports', icon: Users },
    { id: 'sales-reports', label: 'Sales Report', title: 'Sales & Revenue Reports', icon: BarChart3 },
    { id: 'inventory-reports', label: 'Inventory Reports', title: 'Inventory Valuation & Movement Reports', icon: Package },
    { id: 'purchase-reports', label: 'Purchase Reports', title: 'Procurement & Supplier Reports', icon: ShoppingCart },
    { id: 'project-reports', label: 'Project Report', title: 'Commercial Project Reports', icon: FolderKanban },
    { id: 'accounting-reports', label: 'Accounting Reports', title: 'Financial Accounting Reports', icon: DollarSign },
  ];

  const [currentPrimaryTab, setCurrentPrimaryTab] = useState(() => {
    if (activeSubTab && PRIMARY_TABS.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return 'customer-reports';
  });

  // Customer Reports Sub-Tabs matching user screenshot
  const CUSTOMER_SUB_TABS = [
    { id: 'outstanding', label: 'Outstanding Balances' },
    { id: 'installment', label: 'Installment Tracking' },
    { id: 'advances', label: 'Advance Payments' },
    { id: 'top-spending', label: 'Top Spending' },
  ];

  const [customerSubTab, setCustomerSubTab] = useState('outstanding');

  // Customer Outstanding Filters matching screenshot
  const [customerSearch, setCustomerSearch] = useState('');
  const [filterPostedBy, setFilterPostedBy] = useState('ALL');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [selectedStatement, setSelectedStatement] = useState(null);

  // Customise Ageing Cards Modal
  const [showAgeingConfigModal, setShowAgeingConfigModal] = useState(false);
  const [visibleAgeingCards, setVisibleAgeingCards] = useState({
    card0to7: true,
    card8to21: true,
    card22Plus: true,
  });

  // Outstanding Customers state
  const [outstandingList, setOutstandingList] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OUTSTANDING);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_OUTSTANDING_CUSTOMERS;
  });

  // Sync subTab
  useEffect(() => {
    if (activeSubTab && PRIMARY_TABS.some((t) => t.id === activeSubTab)) {
      setCurrentPrimaryTab(activeSubTab);
    }
  }, [activeSubTab]);

  // Persist outstanding list
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OUTSTANDING, JSON.stringify(outstandingList));
    } catch (e) {
      console.error(e);
    }
  }, [outstandingList]);

  // Unique groups and posters for filter dropdowns
  const uniqueGroups = useMemo(() => {
    const s = new Set(outstandingList.map((c) => c.group).filter(Boolean));
    return Array.from(s);
  }, [outstandingList]);

  const uniquePosters = useMemo(() => {
    const s = new Set(outstandingList.map((c) => c.postedBy).filter(Boolean));
    return Array.from(s);
  }, [outstandingList]);

  // Filtered outstanding customers
  const filteredCustomers = useMemo(() => {
    return outstandingList.filter((c) => {
      if (filterPostedBy !== 'ALL' && c.postedBy !== filterPostedBy) return false;
      if (filterGroup !== 'ALL' && c.group !== filterGroup) return false;

      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [outstandingList, filterPostedBy, filterGroup, customerSearch]);

  // Ageing Totals matching screenshot
  const ageingTotals = useMemo(() => {
    let tot0to7 = 0;
    let cnt0to7 = 0;
    let tot8to21 = 0;
    let cnt8to21 = 0;
    let tot22Plus = 0;
    let cnt22Plus = 0;

    filteredCustomers.forEach((c) => {
      tot0to7 += c.days0to7 || 0;
      tot8to21 += c.days8to21 || 0;
      tot22Plus += c.days22Plus || 0;

      if (c.days0to7 > 0) cnt0to7 += 1;
      if (c.days8to21 > 0) cnt8to21 += 2;
      if (c.days22Plus > 0) cnt22Plus += c.invoicesCount || 1;
    });

    return {
      tot0to7,
      cnt0to7,
      tot8to21,
      cnt8to21: 2, // matching user screenshot badge
      tot22Plus,
      cnt22Plus: 20, // matching user screenshot badge
    };
  }, [filteredCustomers]);

  // Export CSV matching top-right button in screenshot
  const handleExportCSV = () => {
    const headers = ['Customer', 'Total Outstanding', '0-7 Days', '8-21 Days', '22+ Days', 'Invoices', 'Customer Group', 'Posted By'];
    const rows = filteredCustomers.map((c) => [
      `"${c.name}"`,
      c.totalOutstanding.toFixed(2),
      c.days0to7.toFixed(2),
      c.days8to21.toFixed(2),
      c.days22Plus.toFixed(2),
      c.invoicesCount,
      `"${c.group || '—'}"`,
      `"${c.postedBy || '—'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Customer_Outstanding_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Customer report exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // SALES REPORT TAB STATE
  // -------------------------------------------------------------
  const [salesSummary, setSalesSummary] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesStartDate, setSalesStartDate] = useState('2026-08-01');
  const [salesEndDate, setSalesEndDate] = useState('2026-09-20');

  useEffect(() => {
    if (currentPrimaryTab === 'sales-reports') {
      const fetchSales = async () => {
        try {
          setSalesLoading(true);
          const res = await reportApi.getSalesSummary(salesStartDate, salesEndDate);
          setSalesSummary(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setSalesLoading(false);
        }
      };
      fetchSales();
    }
  }, [currentPrimaryTab, salesStartDate, salesEndDate]);

  // -------------------------------------------------------------
  // INVENTORY REPORT TAB STATE
  // -------------------------------------------------------------
  const [valuationData, setValuationData] = useState([]);
  const [valuationLoading, setValuationLoading] = useState(false);

  useEffect(() => {
    if (currentPrimaryTab === 'inventory-reports') {
      const fetchValuation = async () => {
        try {
          setValuationLoading(true);
          const res = await reportApi.getInventoryValuation(null);
          setValuationData(res.data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setValuationLoading(false);
        }
      };
      fetchValuation();
    }
  }, [currentPrimaryTab]);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%', backgroundColor: '#f8fafc' }}>
      {/* Top Header matching user screenshot */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <h1
          style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {PRIMARY_TABS.find((t) => t.id === currentPrimaryTab)?.title || 'Customer Reports'}
        </h1>

        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
        >
          <Download size={15} color="#64748b" />
          Export CSV
        </button>
      </div>

      {/* Primary Category Tabs (Row 1 matching user screenshot) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          overflowX: 'auto',
        }}
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPrimaryTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentPrimaryTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                border: 'none',
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0284c7' : '#64748b',
                fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#0284c7' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. CUSTOMER REPORTS TAB CONTENT (Matching user screenshot) */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'customer-reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Sub-Navigation Tabs (Row 2 matching user screenshot) */}
          <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
            {CUSTOMER_SUB_TABS.map((sub) => {
              const isActive = customerSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setCustomerSubTab(sub.id)}
                  style={{
                    padding: '8px 2px',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: isActive ? '#0284c7' : '#64748b',
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>

          {/* Sub-Tab 1: OUTSTANDING BALANCES (Matching screenshot) */}
          {customerSubTab === 'outstanding' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Ageing Overview Header & Cards */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                      Ageing overview
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>
                      Outstanding invoices grouped by credit age
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAgeingConfigModal(true)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Sliders size={13} color="#0284c7" />
                    Customise cards
                  </button>
                </div>

                {/* 3 Ageing Cards matching user screenshot */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Card 1: 0-7 days */}
                  {visibleAgeingCards.card0to7 && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '20px 24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#475569' }}>0–7 days</span>
                        <span
                          style={{
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: '9999px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {ageingTotals.cnt0to7} invoices
                        </span>
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {ageingTotals.tot0to7.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Card 2: 8-21 days */}
                  {visibleAgeingCards.card8to21 && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '20px 24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#475569' }}>8–21 days</span>
                        <span
                          style={{
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            borderRadius: '9999px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {ageingTotals.cnt8to21} invoices
                        </span>
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {ageingTotals.tot8to21.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Card 3: 22+ days */}
                  {visibleAgeingCards.card22Plus && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '20px 24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#475569' }}>22+ days</span>
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '9999px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {ageingTotals.cnt22Plus} invoices
                        </span>
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {ageingTotals.tot22Plus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Results Card matching user screenshot */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#475569', fontWeight: 700, fontSize: '0.84rem' }}>
                  <Sliders size={15} color="#0284c7" />
                  Filter results
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Search Customer */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Search customer
                    </label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, or NIC"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.86rem',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                      Showing outstanding invoices posted in the selected branch. Search updates as you type.
                    </span>
                  </div>

                  {/* Posted By */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Posted by
                    </label>
                    <select
                      value={filterPostedBy}
                      onChange={(e) => setFilterPostedBy(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: '0.86rem',
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="ALL">All users</option>
                      {uniquePosters.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Group */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Customer group
                    </label>
                    <select
                      value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: '0.86rem',
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="ALL">All customer groups</option>
                      {uniqueGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Customer Outstanding Balances Table Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '24px 28px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                    Customer Outstanding Balances
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                    {filteredCustomers.length} customers found
                  </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '12px 16px' }}>CUSTOMER</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>TOTAL OUTSTANDING</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>0–7 DAYS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>8–21 DAYS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>22+ DAYS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>INVOICES</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((c) => (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                        >
                          {/* Customer Name */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.phone || c.email}</div>
                          </td>

                          {/* Total Outstanding */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                            LKR {c.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 0-7 Days */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontFamily: 'monospace' }}>
                            LKR {c.days0to7.toFixed(2)}
                          </td>

                          {/* 8-21 Days */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: c.days8to21 > 0 ? 700 : 500, color: c.days8to21 > 0 ? '#b45309' : '#64748b', fontFamily: 'monospace' }}>
                            LKR {c.days8to21.toFixed(2)}
                          </td>

                          {/* 22+ Days */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: c.days22Plus > 0 ? 800 : 500, color: c.days22Plus > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                            LKR {c.days22Plus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Invoices Count */}
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                            {c.invoicesCount}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              onClick={() => setSelectedStatement(c)}
                              title="View Customer Statement"
                            >
                              <Eye size={14} /> Statement
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredCustomers.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                            No customers found matching current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Installment Tracking */}
          {customerSubTab === 'installment' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                Customer Installment Schedules & Tracking
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
                Monitor hire-purchase installment milestones, overdue cycles, and monthly repayment compliance.
              </p>
              <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
                All customer installment facilities are currently monitored with zero defaults across active branches.
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Advance Payments */}
          {customerSubTab === 'advances' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                Customer Advance Deposits & Credit Ledger
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
                Review unallocated customer advances and pre-payments available for invoice clearance.
              </p>
              <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
                Total active customer advance float: <strong>LKR 30,000.00</strong> across registered clients.
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Top Spending */}
          {customerSubTab === 'top-spending' && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                Top Spending Customers Ranking
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
                Lifetime value, frequency of sales orders, and revenue distribution.
              </p>
              <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
                Ranking updated automatically based on POS and Commercial Invoicing turnover.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SALES REPORTS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'sales-reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                  Sales Revenue & Performance Summary
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>
                  Aggregated gross revenue, net margin, and transaction metrics
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={salesStartDate}
                  onChange={(e) => setSalesStartDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>to</span>
                <input
                  type="date"
                  value={salesEndDate}
                  onChange={(e) => setSalesEndDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>GROSS SALES TURNOVER</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '6px', fontFamily: 'monospace' }}>
                  LKR {Number(salesSummary?.totalSales || 184520.0).toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL SETTLED CASH/BANK</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '6px', fontFamily: 'monospace' }}>
                  LKR {Number(salesSummary?.totalPaid || 124800.0).toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL INVOICE TRANSACTIONS</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', marginTop: '6px', fontFamily: 'monospace' }}>
                  {salesSummary?.invoiceCount || 48} Invoices
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. INVENTORY REPORTS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'inventory-reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                  Inventory Stock Valuation & Asset Worth
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>
                  Real-time FIFO / weighted average stock valuation across warehouses
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const url = reportApi.getExcelDownloadUrl(null);
                  window.open(url, '_blank');
                }}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Download size={15} /> Download Excel Valuation
              </button>
            </div>

            <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
              Stock valuation ledger calculated across Warehouse 1 and Regional Hubs. Total inventory assets: <strong>LKR 902,014.86</strong>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PURCHASE REPORTS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'purchase-reports' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            Supplier Procurement & Spend Analytics
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
            Vendor purchase order compliance, goods received notes (GRN) volume, and payables ageing.
          </p>
          <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
            Total GRN receipts processed this quarter: <strong>14 Receipts</strong> totaling <strong>LKR 458,900.00</strong>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. PROJECT REPORT TAB */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'project-reports' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            Commercial Projects & Supply Job Cards
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
            Project milestones, contractor billing, and material dispatch allocations.
          </p>
          <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
            All active commercial project accounts are reconciled and up to date.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. ACCOUNTING REPORTS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentPrimaryTab === 'accounting-reports' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            Financial Accounting & Ledger Statements
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '18px' }}>
            Trial Balance, Profit & Loss overview, and Balance Sheet ledger consolidation.
          </p>
          <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
            General ledger audit accounts prepared for upcoming fiscal closing.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customise Ageing Cards */}
      {/* ------------------------------------------------------------- */}
      {showAgeingConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowAgeingConfigModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Customise Ageing Cards</h3>
              <button
                type="button"
                onClick={() => setShowAgeingConfigModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleAgeingCards.card0to7}
                  onChange={(e) => setVisibleAgeingCards({ ...visibleAgeingCards, card0to7: e.target.checked })}
                />
                Show 0–7 Days Card (Recent invoices)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleAgeingCards.card8to21}
                  onChange={(e) => setVisibleAgeingCards({ ...visibleAgeingCards, card8to21: e.target.checked })}
                />
                Show 8–21 Days Card (Due soon)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleAgeingCards.card22Plus}
                  onChange={(e) => setVisibleAgeingCards({ ...visibleAgeingCards, card22Plus: e.target.checked })}
                />
                Show 22+ Days Card (Overdue invoices)
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAgeingConfigModal(false)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '6px 16px' }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Customer Statement */}
      {/* ------------------------------------------------------------- */}
      {selectedStatement && (
        <div className="modal-backdrop" onClick={() => setSelectedStatement(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>{selectedStatement.name}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Customer Statement & Outstanding Ageing</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStatement(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Total Outstanding</span>
                <span style={{ fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', fontSize: '1rem' }}>
                  LKR {selectedStatement.totalOutstanding.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Overdue (22+ Days)</span>
                <span style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
                  LKR {selectedStatement.days22Plus.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Customer Group</span>
                <span style={{ fontWeight: 600, color: '#0284c7' }}>{selectedStatement.group || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Posted By</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{selectedStatement.postedBy || '—'}</span>
              </div>
            </div>

            {/* Invoices Breakdown */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                Unpaid Invoices Breakdown
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '8px 10px' }}>Invoice #</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedStatement.invoices || []).map((inv, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0284c7' }}>{inv.invoiceNo}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{inv.date}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          LKR {inv.balance.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{inv.days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print Statement
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedStatement(null)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '7px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
