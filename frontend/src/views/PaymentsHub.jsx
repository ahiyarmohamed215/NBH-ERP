import React, { useState, useEffect, useMemo } from 'react';
import SettlementPanel from '../components/SettlementPanel';
import { formatBusinessDate, invoiceTotal } from '../utils/invoiceMapping';
import { salesApi, paymentApi, customerApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
import {
  CreditCard,
  DollarSign,
  Tag,
  AlertCircle,
  Search,
  Download,
  Printer,
  Plus,
  X,
  Eye,
  CheckCircle,
  FileText,
  Calendar,
  Filter,
} from 'lucide-react';

export default function PaymentsHub({ activeSubTab = 'payments', onSubTabChange }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const canEditPayment = canEditModule(user, 'PAYMENT');

  const PAYMENT_TABS = [
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'advance-payments', label: 'Advance Payment', icon: Tag },
    { id: 'outstanding-payments', label: 'Outstanding Payments', icon: AlertCircle },
  ];

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && PAYMENT_TABS.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return 'payments';
  });

  useEffect(() => {
    if (activeSubTab && PAYMENT_TABS.some((t) => t.id === activeSubTab)) {
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
  // STATE: PAYMENTS DATA & FILTERS
  // -------------------------------------------------------------
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // -------------------------------------------------------------
  // STATE: ADVANCE PAYMENTS DATA & FILTERS
  // -------------------------------------------------------------
  const [advances, setAdvances] = useState([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');

  // -------------------------------------------------------------
  // STATE: OUTSTANDING INVOICES DATA & FILTERS
  // -------------------------------------------------------------
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [outstandingSearchQuery, setOutstandingSearchQuery] = useState('');
  const [outstandingStatusFilter, setOutstandingStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // -------------------------------------------------------------
  // MODALS STATE
  // -------------------------------------------------------------
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerName: '',
    invoiceNo: '',
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: formatBusinessDate(),
    notes: '',
  });

  const [showRecordAdvanceModal, setShowRecordAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    customerName: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    paymentDate: formatBusinessDate(),
    notes: '',
  });

  // -------------------------------------------------------------
  // DATA LOADERS
  // -------------------------------------------------------------
  const loadBackendPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await paymentApi.search({ size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((p) => ({
        id: p.id,
        receiptNo: p.receiptNo || p.paymentNumber,
        paymentNumber: p.paymentNumber,
        invoiceNo: p.invoiceNo || p.invoiceNumber || 'DIRECT',
        invoiceNumber: p.invoiceNumber,
        customerName: p.customerName || 'Walk-in',
        paymentDate: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : ''),
        paymentMethod: p.paymentMethod || 'Cash',
        amount: Number(p.amount || 0),
        status: p.status || 'COMPLETED',
      }));
      setPayments(formatted);
    } catch (err) {
      console.error('Failed to load backend payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadBackendAdvances = async () => {
    try {
      setLoadingAdvances(true);
      const res = await paymentApi.search({ paymentType: 'ADVANCE', size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((p) => ({
        id: p.id,
        voucherNo: p.voucherNo || p.paymentNumber,
        paymentNumber: p.paymentNumber,
        customerName: p.customerName || 'Customer',
        customerId: p.customerId,
        date: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : ''),
        amount: Number(p.amount || 0),
        balance: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || 'Bank Transfer',
        status: p.status || 'ACTIVE',
      }));
      setAdvances(formatted);
    } catch (err) {
      console.error('Failed to load advances:', err);
    } finally {
      setLoadingAdvances(false);
    }
  };

  const loadBackendInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const res = await salesApi.search({ size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((inv) => ({
        id: String(inv.id),
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName || (inv.customer ? inv.customer.name : 'Walk-in'),
        customerId: inv.customerId || (inv.customer ? inv.customer.id : null),
        deliveryStatus: inv.deliveryStatus || 'PENDING',
        deliveryNumber: inv.deliveryNumber || null,
        invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
        displayDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '',
        paymentType: inv.paymentType || (Number(inv.balanceAmount || 0) === 0 ? 'Full Payment' : 'Installment'),
        paymentMethod: inv.paymentMethod || 'Cash',
        totalAmount: invoiceTotal(inv),
        paidAmount: Number(inv.paidAmount || 0),
        balanceAmount: Number(inv.balanceAmount || 0),
        status: inv.status || (Number(inv.balanceAmount || 0) === 0 ? 'PAID' : 'PARTIAL'),
        salesman: inv.salesman || inv.salesmanName || (inv.user ? inv.user.fullName : (user?.fullName || 'Sales Executive')),
        items: inv.items || inv.invoiceItems || inv.lines || [],
      }));
      setInvoices(formatted);
    } catch (err) {
      console.error('Failed to load backend invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    loadBackendPayments();
    loadBackendAdvances();
    loadBackendInvoices();
  }, []);

  const resolveCustomerId = async (name) => {
    try {
      const res = await customerApi.search(name);
      const matches = (res.data || []).filter((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (matches.length === 1) return matches[0].id;
    } catch (err) {
      console.warn('Customer lookup error:', err);
    }
    return undefined;
  };

  // -------------------------------------------------------------
  // ACTIONS: PAYMENTS
  // -------------------------------------------------------------
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.customerName || !paymentForm.amount) {
      addToast('Please provide customer name and payment amount', 'error');
      return;
    }
    const amt = parseFloat(paymentForm.amount) || 0;
    try {
      const payload = {
        customerId: paymentForm.invoiceNo ? undefined : await resolveCustomerId(paymentForm.customerName),
        customerName: paymentForm.customerName,
        invoiceNumber: paymentForm.invoiceNo || null,
        amount: amt,
        paymentMethod: paymentForm.paymentMethod || 'Cash',
        paymentDate: paymentForm.paymentDate || formatBusinessDate(),
        notes: paymentForm.notes || '',
      };
      const res = await paymentApi.create(payload);
      addToast(`Payment receipt ${res.data?.receiptNo || res.data?.paymentNumber || 'recorded'} successfully!`, 'success');
      setShowRecordPaymentModal(false);
      setPaymentForm({
        customerName: '',
        invoiceNo: '',
        amount: '',
        paymentMethod: 'Cash',
        paymentDate: formatBusinessDate(),
        notes: '',
      });
      await Promise.all([loadBackendPayments(), loadBackendInvoices()]);
    } catch (err) {
      console.error('Failed to record payment:', err);
      addToast(err.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  const handleVoidPayment = async (payment) => {
    if (!window.confirm(`Are you sure you want to void payment receipt ${payment.receiptNo || payment.paymentNumber}?`)) {
      return;
    }
    try {
      if (payment.id) {
        await paymentApi.void(payment.id, 'User voided via UI');
      }
      addToast(`Payment ${payment.receiptNo || payment.paymentNumber} voided successfully!`, 'success');
      await Promise.all([loadBackendPayments(), loadBackendInvoices()]);
    } catch (err) {
      console.error('Failed to void payment:', err);
      addToast(err.response?.data?.message || 'Failed to void payment', 'error');
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (paymentMethodFilter !== 'ALL' && p.paymentMethod !== paymentMethodFilter) return false;
      if (paymentSearchQuery.trim()) {
        const query = paymentSearchQuery.toLowerCase();
        return (
          (p.receiptNo || '').toLowerCase().includes(query) ||
          (p.invoiceNo || '').toLowerCase().includes(query) ||
          (p.customerName || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [payments, paymentSearchQuery, paymentMethodFilter]);

  const handleExportPaymentsCSV = () => {
    const headers = ['Receipt #', 'Invoice #', 'Customer', 'Date', 'Method', 'Amount', 'Status'];
    const rows = filteredPayments.map((p) => [
      `"${p.receiptNo || ''}"`,
      `"${p.invoiceNo || ''}"`,
      `"${p.customerName || ''}"`,
      `"${p.paymentDate || ''}"`,
      `"${p.paymentMethod || ''}"`,
      p.amount,
      `"${p.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Payments_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Payments exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // ACTIONS: ADVANCE PAYMENTS
  // -------------------------------------------------------------
  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.customerName || !advanceForm.amount) {
      addToast('Please provide customer name and advance amount', 'error');
      return;
    }
    const amt = parseFloat(advanceForm.amount) || 0;
    try {
      const payload = {
        customerId: await resolveCustomerId(advanceForm.customerName),
        customerName: advanceForm.customerName,
        amount: amt,
        paymentMethod: advanceForm.paymentMethod || 'Bank Transfer',
        paymentDate: advanceForm.paymentDate || formatBusinessDate(),
        notes: advanceForm.notes || '',
      };
      const res = await paymentApi.createAdvance(payload);
      const created = res.data?.data || res.data;
      addToast(`Advance deposit voucher ${created?.paymentNumber || created?.receiptNo || 'recorded'} successfully!`, 'success');
      setShowRecordAdvanceModal(false);
      setAdvanceForm({
        customerName: '',
        amount: '',
        paymentMethod: 'Bank Transfer',
        paymentDate: formatBusinessDate(),
        notes: '',
      });
      await loadBackendAdvances();
    } catch (err) {
      console.error('Failed to record advance:', err);
      addToast(err.response?.data?.message || 'Failed to record advance', 'error');
    }
  };

  const filteredAdvances = useMemo(() => {
    if (!advanceSearchQuery.trim()) return advances;
    const query = advanceSearchQuery.toLowerCase();
    return advances.filter(
      (a) =>
        (a.voucherNo || '').toLowerCase().includes(query) ||
        (a.customerName || '').toLowerCase().includes(query) ||
        (a.paymentMethod || '').toLowerCase().includes(query)
    );
  }, [advances, advanceSearchQuery]);

  const handleExportAdvancesCSV = () => {
    const headers = ['Voucher #', 'Customer', 'Date', 'Total Advance', 'Available Credit', 'Method', 'Status'];
    const rows = filteredAdvances.map((a) => [
      `"${a.voucherNo || ''}"`,
      `"${a.customerName || ''}"`,
      `"${a.date || ''}"`,
      a.amount,
      a.balance,
      `"${a.paymentMethod || ''}"`,
      `"${a.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Advances_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Advance payments exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // ACTIONS: OUTSTANDING PAYMENTS
  // -------------------------------------------------------------
  const outstandingInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const bal = Number(inv.balanceAmount || 0);
      if (bal <= 0 && inv.status === 'PAID') return false;
      if (outstandingStatusFilter !== 'ALL' && inv.status !== outstandingStatusFilter) return false;
      if (outstandingSearchQuery.trim()) {
        const q = outstandingSearchQuery.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const cust = (inv.customerName || '').toLowerCase();
        const method = (inv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !method.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, outstandingStatusFilter, outstandingSearchQuery]);

  const totalOutstandingAmount = useMemo(() => {
    return outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);
  }, [outstandingInvoices]);

  const handleExportOutstandingCSV = () => {
    if (outstandingInvoices.length === 0) {
      addToast('No outstanding invoices to export', 'error');
      return;
    }
    const headers = ['Invoice #', 'Customer', 'Date', 'Payment Type', 'Total Amount', 'Paid Amount', 'Outstanding Balance', 'Status'];
    const rows = outstandingInvoices.map((inv) => [
      `"${inv.invoiceNumber || ''}"`,
      `"${inv.customerName || ''}"`,
      `"${inv.displayDate || inv.invoiceDate || ''}"`,
      `"${inv.paymentType || ''}"`,
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
      `"${inv.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Outstanding_Invoices_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Outstanding invoices exported to CSV', 'success');
  };

  const selectedInvoiceItems = useMemo(() => {
    if (!selectedInvoice) return [];
    if (Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0) {
      return selectedInvoice.items;
    }
    return [];
  }, [selectedInvoice]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '24px',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Page Header (Sticky at top) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
            }}
          >
            Payment Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Track customer payments, advance deposits, outstanding balances, and receipt settlements.
          </p>
        </div>

        {/* Action Button matching current tab */}
        {currentTab === 'advance-payments' ? (
          <button
            type="button"
            onClick={() => setShowRecordAdvanceModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Advance
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPaymentForm({
                customerName: '',
                invoiceNo: '',
                amount: '',
                paymentMethod: 'Cash',
                paymentDate: formatBusinessDate(),
                notes: '',
              });
              setShowRecordPaymentModal(true);
            }}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Payment
          </button>
        )}
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        {PAYMENT_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0284c7' : '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#64748b';
              }}
            >
              <IconComponent size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PAYMENTS (Customer Payments & Receipts) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'payments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Toolbar Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Left Control: Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search payments by receipt #, invoice #, or customer name..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              />
              {paymentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPaymentSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Method filter, Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </select>

              {(paymentSearchQuery || paymentMethodFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentSearchQuery('');
                    setPaymentMethodFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Reset filters"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportPaymentsCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Export payments to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>RECEIPT #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE REFERENCE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AMOUNT PAID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {p.receiptNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                        {p.invoiceNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{p.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{p.paymentMethod}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                        LKR {Number(p.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px' }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => {
                              addToast(`Payment receipt ${p.receiptNo} preview printed`, 'info');
                              window.print();
                            }}
                            style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px' }}
                            title="Print Receipt"
                          >
                            <Printer size={13} /> Print
                          </button>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => handleVoidPayment(p)}
                            style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px', color: '#dc2626' }}
                            title="Void Payment"
                            disabled={p.status === 'VOIDED'}
                          >
                            <X size={13} /> Void
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No payments found matching your search.
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
      {/* TAB 2: ADVANCE PAYMENTS (Customer Advances & Credit Ledger) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'advance-payments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* Quick settlement / allocation panel */}
          <SettlementPanel />

          {/* Toolbar Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Left Control: Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search advances by voucher #, customer, or payment method..."
                value={advanceSearchQuery}
                onChange={(e) => setAdvanceSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              />
              {advanceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdvanceSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {advanceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdvanceSearchQuery('')}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Reset search"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportAdvancesCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Export advances to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VOUCHER #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL ADVANCE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AVAILABLE CREDIT</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvances.map((a) => (
                    <tr
                      key={a.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {a.voucherNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{a.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        LKR {Number(a.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                        LKR {Number(a.balance || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{a.paymentMethod}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px' }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={() => {
                            addToast(`Advance deposit voucher ${a.voucherNo} preview printed`, 'info');
                            window.print();
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px' }}
                          title="Print Advance Voucher"
                        >
                          <Printer size={13} /> Print
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdvances.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No advance records found matching your search.
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
      {/* TAB 3: OUTSTANDING PAYMENTS (Unsettled / Partial Invoices) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'outstanding-payments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', flexShrink: 0 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Outstanding Balance
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '4px', fontFamily: 'monospace' }}>
                Rs. {totalOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending / Partial Invoices
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {outstandingInvoices.length}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Settlement
              </div>
              <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '6px' }}>
                Click <strong>"Pay"</strong> on any row below to instantly record a payment receipt against that bill.
              </div>
            </div>
          </div>

          {/* Toolbar Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Left Control: Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search outstanding invoices by #, customer, or payment method..."
                value={outstandingSearchQuery}
                onChange={(e) => setOutstandingSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
              {outstandingSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOutstandingSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Status filter, Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select
                value={outstandingStatusFilter}
                onChange={(e) => setOutstandingStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.84rem',
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Outstanding</option>
                <option value="PENDING">Pending (Full)</option>
                <option value="PARTIAL">Partial (Part-Paid)</option>
              </select>

              {(outstandingSearchQuery || outstandingStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setOutstandingSearchQuery('');
                    setOutstandingStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={handleExportOutstandingCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Export Outstanding to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT TYPE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BALANCE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                        <CheckCircle size={34} style={{ opacity: 0.35, marginBottom: '8px', color: '#16a34a' }} />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>No outstanding invoices!</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                          All invoices have been settled in full.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    outstandingInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {inv.customerName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>
                          {inv.displayDate || inv.invoiceDate}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {inv.paymentType}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                          Rs. {invoiceTotal(inv).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.paidAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.balanceAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: inv.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                              color: inv.status === 'PARTIAL' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentForm({
                                  customerName: inv.customerName,
                                  invoiceNo: inv.invoiceNumber,
                                  amount: String(inv.balanceAmount || ''),
                                  paymentMethod: 'Cash',
                                  paymentDate: formatBusinessDate(),
                                  notes: `Settlement for invoice ${inv.invoiceNumber}`,
                                });
                                setShowRecordPaymentModal(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              title="Record payment against this invoice"
                            >
                              <Plus size={12} /> Pay
                            </button>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              onClick={() => setSelectedInvoice(inv)}
                              style={{ padding: '4px 7px', fontSize: '0.74rem', borderRadius: '5px' }}
                              title="View invoice details"
                            >
                              <Eye size={13} />
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
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Record Payment Receipt */}
      {/* ------------------------------------------------------------- */}
      {showRecordPaymentModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>Record Payment Receipt</h3>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Negombo Motors"
                  value={paymentForm.customerName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Invoice # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-000001"
                    value={paymentForm.invoiceNo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoiceNo: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Date</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment notes or cheque details..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowRecordPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Record Advance Payment */}
      {/* ------------------------------------------------------------- */}
      {showRecordAdvanceModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>Record Advance Payment</h3>
              <button
                type="button"
                onClick={() => setShowRecordAdvanceModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Voucher #</label>
                  <input
                    type="text"
                    readOnly
                    value="[Auto-generated by backend]"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.86rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
                  <input
                    type="date"
                    value={advanceForm.paymentDate}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering Ltd"
                  value={advanceForm.customerName}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Advance Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={advanceForm.amount}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select
                    value={advanceForm.paymentMethod}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Deposit notes / project reference..."
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowRecordAdvanceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  Save Advance Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Outstanding Invoice Details */}
      {/* ------------------------------------------------------------- */}
      {selectedInvoice && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1200, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #0284c7', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>COMMERCIAL INVOICE</h3>
                    <div style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedInvoice.invoiceNumber}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    backgroundColor: selectedInvoice.status === 'PAID' ? '#dcfce7' : selectedInvoice.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                    color: selectedInvoice.status === 'PAID' ? '#15803d' : selectedInvoice.status === 'PARTIAL' ? '#b45309' : '#b91c1c',
                  }}
                >
                  {selectedInvoice.status || 'PENDING'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '22px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Billed Customer</span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.customerName || 'Walk-in Customer'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  Payment: <strong style={{ color: '#334155' }}>{selectedInvoice.paymentType || 'Full Payment'} ({selectedInvoice.paymentMethod || 'Cash'})</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Invoice Date & Time</span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.displayDate || selectedInvoice.invoiceDate || new Date().toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  Salesman: <strong style={{ color: '#334155' }}>{selectedInvoice.salesman || 'Sales Executive'}</strong>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
                  INVOICED LINE ITEMS ({selectedInvoiceItems.length})
                </h4>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', width: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '8px 12px', width: '130px' }}>SKU / CODE</th>
                      <th style={{ padding: '8px 12px' }}>PRODUCT / DESCRIPTION</th>
                      <th style={{ padding: '8px 12px', width: '60px', textAlign: 'center' }}>QTY</th>
                      <th style={{ padding: '8px 12px', width: '110px', textAlign: 'right' }}>UNIT PRICE</th>
                      <th style={{ padding: '8px 12px', width: '120px', textAlign: 'right' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {item.code || item.productSku || item.sku || '-'}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>
                          {item.name || item.productName || 'Product item'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {item.quantity || 1}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                          LKR {(Number(item.unitPrice) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          LKR {(Number(item.totalPrice || (item.quantity * item.unitPrice)) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {selectedInvoiceItems.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                          No line items recorded for this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <div style={{ width: '100%', maxWidth: '340px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.88rem' }}>
                  <span style={{ color: '#64748b' }}>Gross Total</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    LKR {Number(selectedInvoice.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.88rem' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Amount Settled</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                    LKR {Number(selectedInvoice.paidAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: '0.95rem' }}>
                  <span style={{ color: Number(selectedInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                    Balance Outstanding
                  </span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', color: Number(selectedInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b' }}>
                    LKR {Number(selectedInvoice.balanceAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const inv = selectedInvoice;
                  setSelectedInvoice(null);
                  setPaymentForm({
                    customerName: inv.customerName,
                    invoiceNo: inv.invoiceNumber,
                    amount: String(inv.balanceAmount || ''),
                    paymentMethod: 'Cash',
                    paymentDate: formatBusinessDate(),
                    notes: `Settlement for invoice ${inv.invoiceNumber}`,
                  });
                  setShowRecordPaymentModal(true);
                }}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                <Plus size={15} /> Record Payment Against Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
