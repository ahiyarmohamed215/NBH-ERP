import React, { useState, useEffect, useMemo } from 'react';
import { salesApi, salesReturnApi, pdfApi, customerApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import PosView from './PosView';
import SalesReturnsView from './SalesReturnsView';
import {
  FileText,
  ClipboardList,
  DollarSign,
  Tag,
  RotateCcw,
  Search,
  Sliders,
  Download,
  Calendar,
  Eye,
  Printer,
  Plus,
  X,
  RefreshCw,
  ShoppingCart,
  CheckCircle,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';

const STORAGE_KEY_INVOICES = 'erp_commercial_invoices_v1';
const STORAGE_KEY_QUOTATIONS = 'erp_quotations_v1';
const STORAGE_KEY_ORDERS = 'erp_sales_orders_v1';
const STORAGE_KEY_PAYMENTS = 'erp_customer_payments_v1';
const STORAGE_KEY_ADVANCES = 'erp_advance_payments_v1';

// Seeded Invoices matching user screenshot
const INITIAL_INVOICES = [
  {
    id: 'inv-94',
    invoiceNumber: '26SEP_MB_:94',
    customerName: 'Negombo Motors',
    customerId: '1',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-09-07',
    displayDate: 'Sep 7, 2026',
    paymentType: 'Full Payment',
    paymentMethod: 'Cheque',
    totalAmount: 118.0,
    paidAmount: 118.0,
    balanceAmount: 0.0,
    status: 'PAID',
  },
  {
    id: 'inv-93',
    invoiceNumber: '26AUG_MB_:93',
    customerName: 'AIA',
    customerId: '2',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-08-24',
    displayDate: 'Aug 24, 2026',
    paymentType: 'Installment',
    paymentMethod: 'Cash',
    totalAmount: 238.8,
    paidAmount: 10.0,
    balanceAmount: 228.8,
    status: 'PARTIAL',
  },
  {
    id: 'inv-92',
    invoiceNumber: '26AUG_MB_:92',
    customerName: 'AIA',
    customerId: '2',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-08-24',
    displayDate: 'Aug 24, 2026',
    paymentType: 'Installment',
    paymentMethod: 'Cash',
    totalAmount: 128.0,
    paidAmount: 18.0,
    balanceAmount: 110.0,
    status: 'PARTIAL',
  },
  {
    id: 'inv-91',
    invoiceNumber: '26AUG_MB_:91',
    customerName: 'Walk-in',
    customerId: '3',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-08-24',
    displayDate: 'Aug 24, 2026',
    paymentType: 'Full Payment',
    paymentMethod: 'Cash',
    totalAmount: 118.0,
    paidAmount: 118.0,
    balanceAmount: 0.0,
    status: 'PAID',
  },
  {
    id: 'inv-90',
    invoiceNumber: '26AUG_MB_:90',
    customerName: 'Walk-in',
    customerId: '3',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-08-23',
    displayDate: 'Aug 23, 2026',
    paymentType: 'Full Payment',
    paymentMethod: 'Cash',
    totalAmount: 151.33,
    paidAmount: 151.33,
    balanceAmount: 0.0,
    status: 'PAID',
  },
  {
    id: 'inv-89',
    invoiceNumber: '26AUG_MB_:89',
    customerName: 'Walk-in',
    customerId: '3',
    deliveryStatus: 'Not Delivered',
    invoiceDate: '2026-08-22',
    displayDate: 'Aug 22, 2026',
    paymentType: 'Full Payment',
    paymentMethod: 'Cash',
    totalAmount: 124.21,
    paidAmount: 124.21,
    balanceAmount: 0.0,
    status: 'PAID',
  },
];

const INITIAL_QUOTATIONS = [
  {
    id: 'qt-1',
    quotationNo: 'QT-2026-001',
    customerName: 'Negombo Motors',
    date: '2026-09-18',
    validUntil: '2026-10-18',
    totalAmount: 45000.0,
    status: 'ACCEPTED',
  },
  {
    id: 'qt-2',
    quotationNo: 'QT-2026-002',
    customerName: 'AIA Insurance',
    date: '2026-09-15',
    validUntil: '2026-10-15',
    totalAmount: 125000.0,
    status: 'SENT',
  },
];

const INITIAL_ORDERS = [
  {
    id: 'ord-1',
    orderNo: 'SO-2026-001',
    customerName: 'Negombo Motors',
    orderDate: '2026-09-19',
    deliveryDate: '2026-09-25',
    totalAmount: 45000.0,
    paymentStatus: 'PAID',
    orderStatus: 'CONFIRMED',
  },
  {
    id: 'ord-2',
    orderNo: 'SO-2026-002',
    customerName: 'AIA Insurance',
    orderDate: '2026-09-16',
    deliveryDate: '2026-09-22',
    totalAmount: 125000.0,
    paymentStatus: 'PARTIAL',
    orderStatus: 'PROCESSING',
  },
];

const INITIAL_PAYMENTS = [
  {
    id: 'pmt-1',
    receiptNo: 'REC-2026-094',
    invoiceNo: '26SEP_MB_:94',
    customerName: 'Negombo Motors',
    paymentDate: '2026-09-07',
    paymentMethod: 'Cheque',
    amount: 118.0,
    status: 'CLEARED',
  },
  {
    id: 'pmt-2',
    receiptNo: 'REC-2026-093',
    invoiceNo: '26AUG_MB_:93',
    customerName: 'AIA',
    paymentDate: '2026-08-24',
    paymentMethod: 'Cash',
    amount: 10.0,
    status: 'RECEIVED',
  },
];

const INITIAL_ADVANCES = [
  {
    id: 'adv-1',
    voucherNo: 'ADV-2026-01',
    customerName: 'Negombo Motors',
    date: '2026-09-05',
    amount: 25000.0,
    balance: 5000.0,
    paymentMethod: 'Bank Transfer',
    status: 'ACTIVE',
  },
];

export default function InvoicingHub({ activeSubTab = 'sales', onSubTabChange }) {
  const { addToast } = useToast();

  const INVOICING_TABS = [
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'sales', label: 'Sales', icon: FileText },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'advance-payments', label: 'Advance Payments', icon: Tag },
    { id: 'refunds', label: 'Refunds', icon: RotateCcw },
  ];

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && (INVOICING_TABS.some((t) => t.id === activeSubTab) || activeSubTab === 'pos')) {
      return activeSubTab;
    }
    return 'sales';
  });

  useEffect(() => {
    if (activeSubTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: SALES (Commercial Invoices - Matching Screenshot)
  // -------------------------------------------------------------
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INVOICES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_INVOICES;
  });

  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPaymentType, setFilterPaymentType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Customise columns modal
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    invoiceNumber: true,
    customer: true,
    delivery: true,
    date: true,
    paymentType: true,
    paymentMethod: true,
    total: true,
    paid: true,
    balance: true,
  });

  // Load live invoices from backend if available
  useEffect(() => {
    const loadBackendInvoices = async () => {
      try {
        setLoadingInvoices(true);
        const res = await salesApi.search({ size: 100 });
        const liveList = res.data?.content || res.data || [];
        if (liveList.length > 0) {
          // Normalize and merge live backend invoices with screenshot sample invoices
          const formattedLive = liveList.map((inv) => ({
            id: String(inv.id),
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName || 'Walk-in',
            customerId: inv.customerId,
            deliveryStatus: 'Not Delivered',
            invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '2026-09-20',
            displayDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : 'Sep 20, 2026',
            paymentType: inv.paymentType || (Number(inv.balanceAmount || 0) === 0 ? 'Full Payment' : 'Installment'),
            paymentMethod: inv.paymentMethod || 'Cash',
            totalAmount: Number(inv.totalAmount || 0),
            paidAmount: Number(inv.paidAmount || 0),
            balanceAmount: Number(inv.balanceAmount || 0),
            status: inv.status || (Number(inv.balanceAmount || 0) === 0 ? 'PAID' : 'PARTIAL'),
          }));

          setInvoices((prev) => {
            const combined = [...formattedLive];
            INITIAL_INVOICES.forEach((seed) => {
              if (!combined.some((item) => item.invoiceNumber === seed.invoiceNumber)) {
                combined.push(seed);
              }
            });
            return combined;
          });
        }
      } catch (err) {
        console.error('Failed to load backend invoices:', err);
      } finally {
        setLoadingInvoices(false);
      }
    };
    loadBackendInvoices();
  }, []);

  // Persist invoices
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices));
    } catch (e) {
      console.error(e);
    }
  }, [invoices]);

  // Date range presets
  const handleDatePreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this-week') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this-month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'PAID' && inv.status !== 'PAID') return false;
        if (filterStatus === 'PARTIAL' && inv.status !== 'PARTIAL') return false;
        if (filterStatus === 'PENDING' && inv.status !== 'PENDING') return false;
      }

      if (filterPaymentType !== 'ALL' && inv.paymentType !== filterPaymentType) {
        return false;
      }

      if (startDate && inv.invoiceDate && inv.invoiceDate < startDate) {
        return false;
      }
      if (endDate && inv.invoiceDate && inv.invoiceDate > endDate) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const cust = (inv.customerName || '').toLowerCase();
        const method = (inv.paymentMethod || '').toLowerCase();
        const ptype = (inv.paymentType || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !method.includes(q) && !ptype.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, filterStatus, filterPaymentType, startDate, endDate, searchQuery]);

  // CSV Export matching top-right button in screenshot
  const handleExportCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Delivery', 'Date', 'Payment Type', 'Payment Method', 'Total', 'Paid', 'Balance'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      `"${inv.customerName}"`,
      inv.deliveryStatus,
      inv.displayDate || inv.invoiceDate,
      inv.paymentType,
      inv.paymentMethod,
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Invoices_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Invoices exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // OTHER TABS DATA (Quotations, Orders, Payments, Advances)
  // -------------------------------------------------------------
  const [quotations] = useState(INITIAL_QUOTATIONS);
  const [orders] = useState(INITIAL_ORDERS);
  const [payments] = useState(INITIAL_PAYMENTS);
  const [advances] = useState(INITIAL_ADVANCES);

  return (
    <div
      style={{
        padding: '24px 32px',
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Header (Fixed / Sticky at Top) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Invoicing Management
          </h1>
        </div>

        {/* Top-Right Action Area: POS Mode + Export CSV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Prominent Green POS Mode Button */}
          <button
            type="button"
            onClick={() => handleTabClick(currentTab === 'pos' ? 'sales' : 'pos')}
            style={{
              backgroundColor: currentTab === 'pos' ? '#059669' : '#16a34a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.84rem',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = currentTab === 'pos' ? '#047857' : '#15803d')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = currentTab === 'pos' ? '#059669' : '#16a34a')}
            title={currentTab === 'pos' ? 'Exit POS Mode' : 'Open POS Terminal'}
          >
            <ShoppingCart size={16} />
            {currentTab === 'pos' ? 'Exit POS Mode' : 'POS Mode'}
          </button>

          {/* Export CSV button matching screenshot */}
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
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <Download size={15} color="#64748b" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Fixed / Sticky at Top) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {INVOICING_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
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
      {/* IF POS MODE ACTIVE */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'pos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '0.88rem', fontWeight: 600 }}>
              <ShoppingCart size={18} color="#16a34a" />
              <span>POS Terminal Mode Active</span>
            </div>
            <button
              type="button"
              onClick={() => handleTabClick('sales')}
              style={{
                backgroundColor: '#ffffff',
                color: '#166534',
                border: '1px solid #86efac',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Exit to Invoices
            </button>
          </div>
          <PosView />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SALES (Commercial Invoices - Matching Screenshot) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'sales' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Card Container for Filters matching screenshot (Fixed / Sticky) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              flexShrink: 0,
            }}
          >
            {/* Filter Row 1: Search, Status, Payment Type, Customise Columns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '280px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search invoice no, customer, reference, or remark..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Status Dropdown */}
              <div style={{ minWidth: '160px' }}>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>

              {/* Payment Type Dropdown */}
              <div style={{ minWidth: '180px' }}>
                <select
                  value={filterPaymentType}
                  onChange={(e) => setFilterPaymentType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Payment Types</option>
                  <option value="Full Payment">Full Payment</option>
                  <option value="Installment">Installment</option>
                </select>
              </div>

              {/* Customise Columns button */}
              <button
                type="button"
                onClick={() => setShowColumnModal(true)}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Sliders size={15} color="#0284c7" />
                Customise Columns
              </button>
            </div>

            {/* Filter Row 2: Date Picker & Quick Range Pills matching screenshot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Calendar size={14} color="#0284c7" />
                  INVOICE DATE
                </span>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#334155',
                  }}
                />
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#334155',
                  }}
                />

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              {/* Quick Range Pills matching screenshot */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleDatePreset('today')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('this-week')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('this-month')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  This Month
                </button>
              </div>
            </div>
          </div>

          {/* Invoices Table Card (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {visibleColumns.invoiceNumber && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE #</th>}
                    {visibleColumns.customer && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>}
                    {visibleColumns.delivery && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DELIVERY</th>}
                    {visibleColumns.date && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>}
                    {visibleColumns.paymentType && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT TYPE</th>}
                    {visibleColumns.paymentMethod && <th style={{ padding: '12px 16px', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT METHOD</th>}
                    {visibleColumns.total && <th style={{ padding: '12px 16px', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>}
                    {visibleColumns.paid && <th style={{ padding: '12px 16px', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAID</th>}
                    {visibleColumns.balance && <th style={{ padding: '12px 16px', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BALANCE</th>}
                    <th style={{ padding: '12px 16px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa')}
                    >
                      {/* Invoice # */}
                      {visibleColumns.invoiceNumber && (
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                      )}

                      {/* Customer */}
                      {visibleColumns.customer && (
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {inv.customerName}
                        </td>
                      )}

                      {/* Delivery Status Badge matching screenshot */}
                      {visibleColumns.delivery && (
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              borderRadius: '9999px',
                              padding: '3px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {inv.deliveryStatus || 'Not Delivered'}
                          </span>
                        </td>
                      )}

                      {/* Date */}
                      {visibleColumns.date && (
                        <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {inv.displayDate || inv.invoiceDate}
                        </td>
                      )}

                      {/* Payment Type */}
                      {visibleColumns.paymentType && (
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {inv.paymentType}
                        </td>
                      )}

                      {/* Payment Method */}
                      {visibleColumns.paymentMethod && (
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {inv.paymentMethod}
                        </td>
                      )}

                      {/* Total */}
                      {visibleColumns.total && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          LKR {Number(inv.totalAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Paid */}
                      {visibleColumns.paid && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                          LKR {Number(inv.paidAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Balance */}
                      {visibleColumns.balance && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: Number(inv.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                          LKR {Number(inv.balanceAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Invoice Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => {
                              if (inv.id && !inv.id.startsWith('inv-')) {
                                pdfApi.printInvoice(inv.id);
                              } else {
                                window.print();
                              }
                            }}
                            title="Print Invoice PDF"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        {loadingInvoices ? 'Loading invoices...' : 'No invoices match the selected filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: QUOTATIONS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'quotations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Customer Quotations & Estimates
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Prepare commercial quotations and convert approved estimates directly into invoices.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addToast('Create Quotation draft opened', 'info')}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Plus size={16} /> Create Quotation
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Quotation #</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Quotation Date</th>
                  <th style={{ padding: '12px 16px' }}>Valid Until</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((qt) => (
                  <tr key={qt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                      {qt.quotationNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{qt.customerName}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{qt.date}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{qt.validUntil}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      LKR {qt.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${qt.status === 'ACCEPTED' ? 'badge-success' : 'badge-info'}`}>
                        {qt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ORDERS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Sales Orders & Proformas
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Manage customer purchase orders, confirmation status, and dispatch tracking.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addToast('Create Sales Order form opened', 'info')}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Plus size={16} /> Create Order
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Order #</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Order Date</th>
                  <th style={{ padding: '12px 16px' }}>Delivery Expected</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Payment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Order Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                      {ord.orderNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{ord.customerName}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{ord.orderDate}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{ord.deliveryDate}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      LKR {ord.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${ord.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge badge-info">{ord.orderStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: PAYMENTS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Customer Payment Receipts
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Ledger of settled customer payments across Cash, Cheque, Card, and Bank Transits.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addToast('Record Payment voucher opened', 'info')}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Plus size={16} /> Record Payment
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Receipt #</th>
                  <th style={{ padding: '12px 16px' }}>Invoice Reference</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Method</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                      {p.receiptNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                      {p.invoiceNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.customerName}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{p.paymentDate}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{p.paymentMethod}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                      LKR {p.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge badge-success">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: ADVANCE PAYMENTS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'advance-payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Customer Advance Payments
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Manage customer security deposits, down payments, and available credit balances.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addToast('Record Advance Payment opened', 'info')}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Plus size={16} /> Record Advance
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Voucher #</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Advance</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Available Credit</th>
                  <th style={{ padding: '12px 16px' }}>Method</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                      {a.voucherNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a.customerName}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{a.date}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      LKR {a.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                      LKR {a.balance.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{a.paymentMethod}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge badge-success">{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: REFUNDS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'refunds' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <SalesReturnsView />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customise Columns */}
      {/* ------------------------------------------------------------- */}
      {showColumnModal && (
        <div className="modal-backdrop" onClick={() => setShowColumnModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Customise Invoicing Columns</h3>
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
              {Object.keys(visibleColumns).map((colKey) => (
                <label
                  key={colKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[colKey]}
                    onChange={(e) =>
                      setVisibleColumns({
                        ...visibleColumns,
                        [colKey]: e.target.checked,
                      })
                    }
                  />
                  <span style={{ textTransform: 'capitalize', color: '#334155', fontWeight: 500 }}>
                    {colKey.replace(/([A-Z])/g, ' $1')}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowColumnModal(false)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '6px 16px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Invoice Details */}
      {/* ------------------------------------------------------------- */}
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{selectedInvoice.invoiceNumber}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: {selectedInvoice.displayDate || selectedInvoice.invoiceDate}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Customer</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedInvoice.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Delivery Status</span>
                <span style={{ fontWeight: 600, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.74rem' }}>
                  {selectedInvoice.deliveryStatus || 'Not Delivered'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Payment Type</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{selectedInvoice.paymentType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Payment Method</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{selectedInvoice.paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Invoice Total</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '1rem' }}>
                  LKR {Number(selectedInvoice.totalAmount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Amount Settled</span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                  LKR {Number(selectedInvoice.paidAmount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#64748b' }}>Outstanding Balance</span>
                <span style={{ fontWeight: 800, color: Number(selectedInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                  LKR {Number(selectedInvoice.balanceAmount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => {
                  if (selectedInvoice.id && !selectedInvoice.id.startsWith('inv-')) {
                    pdfApi.printInvoice(selectedInvoice.id);
                  } else {
                    window.print();
                  }
                }}
              >
                <Printer size={15} /> Print Invoice PDF
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedInvoice(null)}
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
