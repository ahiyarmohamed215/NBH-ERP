import {useDataSync} from '../hooks/useDataSync';
import {canWriteTab,hasPermission,canAccessTab} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import StatusBadge from '../components/StatusBadge';
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
  RotateCcw,
} from 'lucide-react';

export default function PaymentsHub({ activeSubTab = 'payments', onSubTabChange }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const canEditPayment = canEditModule(user, 'PAYMENT');

  const PAYMENT_TABS = [
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'advance-payments', label: 'Advance Payment', icon: Tag },
    { id: 'refunds', label: 'Refunds', icon: RotateCcw },
    { id: 'outstanding-payments', label: 'Outstanding Payments', icon: AlertCircle },
  ];

  const [currentTab, setCurrentTab] = useModuleTab('payments',activeSubTab,'payments',user);

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
  const [isSavingPayment, setIsSavingPayment] = useState(false);
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
  // STATE: REFUNDS DATA & FILTERS
  // -------------------------------------------------------------
  const [refunds, setRefunds] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [refundSearchQuery, setRefundSearchQuery] = useState('');
  const [refundMethodFilter, setRefundMethodFilter] = useState('ALL');
  const [showRecordRefundModal, setShowRecordRefundModal] = useState(false);
  const [isSavingRefund, setIsSavingRefund] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [refundForm, setRefundForm] = useState({
    customerId: '',
    customerName: '',
    advanceVoucherId: '',
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: formatBusinessDate(),
    referenceNumber: '',
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
    if(!canAccessTab(user,'payments','outstanding-payments')){setInvoices([]);return;}
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

  const loadBackendRefunds = async () => {
    try {
      setLoadingRefunds(true);
      const res = await paymentApi.search({ paymentType: 'REFUND', size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((p) => ({
        id: p.id,
        refundNo: p.receiptNo || p.paymentNumber,
        paymentNumber: p.paymentNumber,
        customerName: p.customerName || 'Customer',
        customerId: p.customerId,
        paymentDate: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : ''),
        paymentMethod: p.paymentMethod || 'Cash',
        referenceNumber: p.referenceNumber || '—',
        amount: Number(p.amount || 0),
        status: p.status || 'COMPLETED',
        notes: p.notes || '',
      }));
      setRefunds(formatted);
    } catch (err) {
      console.error('Failed to load backend refunds:', err);
    } finally {
      setLoadingRefunds(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await customerApi.getAll();
      setCustomersList(res.data || []);
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    loadBackendPayments();
    loadBackendAdvances();
    loadBackendRefunds();
    loadBackendInvoices();
    loadCustomers();
  }, []);

  useDataSync(() => Promise.allSettled([loadBackendPayments(),loadBackendAdvances(),loadBackendRefunds(),loadBackendInvoices(),loadCustomers()]), ['erp:sales_updated','erp:customers_updated'], [], ['payments','returns','sales','customers']);
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
    if (isSavingPayment) return;
    if (!paymentForm.customerName || !paymentForm.amount) {
      addToast('Please provide customer name and payment amount', 'error');
      return;
    }
    const amt = parseFloat(paymentForm.amount) || 0;
    setIsSavingPayment(true);
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
      if (err.isUnknownStatus) {
        addToast("We couldn't confirm the payment status. Please check the payment record before trying again.", 'warning');
      } else {
        addToast('Unable to process payment. Please try again.', 'error');
      }
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleVoidPayment = async (payment) => {
    if(!canEditPayment){addToast('You do not have permission to void payments.','error');return;}
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
    if (isSavingPayment) return;
    if (!advanceForm.customerName || !advanceForm.amount) {
      addToast('Please provide customer name and advance amount', 'error');
      return;
    }
    const amt = parseFloat(advanceForm.amount) || 0;
    setIsSavingPayment(true);
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
      if (err.isUnknownStatus) {
        addToast("We couldn't confirm the payment status. Please check the payment record before trying again.", 'warning');
      } else {
        addToast('Unable to process payment. Please try again.', 'error');
      }
    } finally {
      setIsSavingPayment(false);
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
  // ACTIONS: REFUNDS
  // -------------------------------------------------------------
  const handleSaveRefund = async (e) => {
    e.preventDefault();
    if (isSavingRefund) return;
    if (!refundForm.customerName || !refundForm.amount) {
      addToast('Please provide customer name and refund amount', 'error');
      return;
    }
    const amt = parseFloat(refundForm.amount) || 0;
    if (amt <= 0) {
      addToast('Refund amount must be greater than zero', 'error');
      return;
    }
    setIsSavingRefund(true);
    try {
      const cId = refundForm.customerId || (await resolveCustomerId(refundForm.customerName));
      const payload = {
        customerId: cId,
        customerName: refundForm.customerName,
        amount: amt,
        paymentMethod: refundForm.paymentMethod || 'Cash',
        paymentDate: refundForm.paymentDate || formatBusinessDate(),
        referenceNumber: refundForm.referenceNumber || (refundForm.advanceVoucherId ? `Adv: ${refundForm.advanceVoucherId}` : ''),
        notes: refundForm.notes || 'Customer refund for advance / invoice return',
      };
      const res = await paymentApi.createRefund(payload);
      const created = res.data?.data || res.data;
      addToast(`Customer refund ${created?.paymentNumber || created?.receiptNo || 'voucher'} processed successfully!`, 'success');
      setShowRecordRefundModal(false);
      setRefundForm({
        customerId: '',
        customerName: '',
        advanceVoucherId: '',
        amount: '',
        paymentMethod: 'Cash',
        paymentDate: formatBusinessDate(),
        referenceNumber: '',
        notes: '',
      });
      await Promise.all([loadBackendRefunds(), loadBackendAdvances(), loadBackendPayments()]);
    } catch (err) {
      console.error('Failed to process refund:', err);
      addToast(err.response?.data?.message || err.message || 'Unable to process refund. Please try again.', 'error');
    } finally {
      setIsSavingRefund(false);
    }
  };

  const handleVoidRefund = async (refund) => {
    if (!canEditPayment) {
      addToast('You do not have permission to void refunds.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to void refund voucher ${refund.refundNo || refund.paymentNumber}?`)) {
      return;
    }
    try {
      if (refund.id) {
        await paymentApi.void(refund.id, 'User voided via UI');
      }
      addToast(`Refund ${refund.refundNo || refund.paymentNumber} voided successfully!`, 'success');
      await Promise.all([loadBackendRefunds(), loadBackendAdvances(), loadBackendPayments()]);
    } catch (err) {
      console.error('Failed to void refund:', err);
      addToast(err.response?.data?.message || 'Failed to void refund', 'error');
    }
  };

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (refundMethodFilter !== 'ALL' && r.paymentMethod !== refundMethodFilter) return false;
      if (refundSearchQuery.trim()) {
        const query = refundSearchQuery.toLowerCase();
        return (
          (r.refundNo || '').toLowerCase().includes(query) ||
          (r.customerName || '').toLowerCase().includes(query) ||
          (r.referenceNumber || '').toLowerCase().includes(query) ||
          (r.notes || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [refunds, refundSearchQuery, refundMethodFilter]);

  const totalRefundsAmount = useMemo(() => {
    return filteredRefunds
      .filter((r) => r.status !== 'VOIDED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [filteredRefunds]);

  const handleExportRefundsCSV = () => {
    const headers = ['Refund #', 'Customer', 'Date', 'Method', 'Reference #', 'Amount', 'Status', 'Notes'];
    const rows = filteredRefunds.map((r) => [
      `"${r.refundNo || ''}"`,
      `"${r.customerName || ''}"`,
      `"${r.paymentDate || ''}"`,
      `"${r.paymentMethod || ''}"`,
      `"${r.referenceNumber || ''}"`,
      r.amount,
      `"${r.status || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Refunds_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Refund records exported to CSV', 'success');
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
    <div className="erp-page"
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
      <div className="erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="erp-page-title"

          >
            Payment Management
          </h1>
          <p className="erp-page-description">
            Track customer payments, advance deposits, outstanding balances, and receipt settlements.
          </p>
        </div>

        {/* Action Button matching current tab */}
        {currentTab === 'advance-payments' ? (
          <button disabled={!canWriteTab(user,'payments',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={() => setShowRecordAdvanceModal(true)}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Advance
          </button>
        ) : currentTab === 'refunds' ? (
          <button disabled={!canWriteTab(user,'payments',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={() => {
              setRefundForm({
                customerId: '',
                customerName: '',
                advanceVoucherId: '',
                amount: '',
                paymentMethod: 'Cash',
                paymentDate: formatBusinessDate(),
                referenceNumber: '',
                notes: '',
              });
              setShowRecordRefundModal(true);
            }}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={17} /> Process Refund
          </button>
        ) : (
          <button disabled={!canWriteTab(user,'payments',currentTab)} className="erp-button erp-button-primary"
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
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Payment
          </button>
        )}
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <ErpTabs module="payments"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        {PAYMENT_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <ErpTab tabId={tab.id} data-active={isActive} aria-pressed={isActive}
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}



            >
              <IconComponent size={16} />
              {tab.label}
            </ErpTab>
          );
        })}
      </ErpTabs>

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
              <input className="erp-field"
                type="text"
                placeholder="Search payments by receipt #, invoice #, or customer name..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
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
              <select className="erp-field"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  border: '1px solid #cbd5e1',
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
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setPaymentSearchQuery('');
                    setPaymentMethodFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--erp-text-field)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>RECEIPT #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE REFERENCE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AMOUNT PAID</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
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
                      <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {p.receiptNo}
                      </td>
                      <td className="erp-table-cell erp-table-code" style={{ fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                        {p.invoiceNo}
                      </td>
                      <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{p.customerName}</td>
                      <td className="erp-table-cell" style={{ color: '#64748b' }}>
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="erp-table-cell" style={{ color: '#334155' }}>{p.paymentMethod}</td>
                      <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                        LKR {Number(p.amount || 0).toFixed(2)}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button aria-label="Print Receipt"
                            type="button"
                            className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                            onClick={() => {
                              addToast(`Payment receipt ${p.receiptNo} preview printed`, 'info');
                              window.print();
                            }}
                            style={{ padding: '4px 8px' }}
                            title="Print Receipt"
                          ><Printer size={13} /></button>
                          <button data-tone="danger" aria-label="Void Payment"
                            type="button"
                            className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                            onClick={() => handleVoidPayment(p)}
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            title="Void Payment"
                            disabled={!canEditPayment || p.status === 'VOIDED'}
                          ><X size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>
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
              <input className="erp-field"
                type="text"
                placeholder="Search advances by voucher #, customer, or payment method..."
                value={advanceSearchQuery}
                onChange={(e) => setAdvanceSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
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
                <button className="erp-button"
                  type="button"
                  onClick={() => setAdvanceSearchQuery('')}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--erp-text-field)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VOUCHER #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL ADVANCE</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AVAILABLE CREDIT</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
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
                      <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {a.voucherNo}
                      </td>
                      <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{a.customerName}</td>
                      <td className="erp-table-cell" style={{ color: '#64748b' }}>
                        {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        LKR {Number(a.amount || 0).toFixed(2)}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                        LKR {Number(a.balance || 0).toFixed(2)}
                      </td>
                      <td className="erp-table-cell" style={{ color: '#334155' }}>{a.paymentMethod}</td>
                      <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button aria-label="Print Advance Voucher"
                          type="button"
                          className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                          onClick={() => {
                            addToast(`Advance deposit voucher ${a.voucherNo} preview printed`, 'info');
                            window.print();
                          }}
                          style={{ padding: '4px 8px' }}
                          title="Print Advance Voucher"
                        ><Printer size={13} /></button>
                        <button aria-label="Refund Advance Deposit"
                          type="button"
                          className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                          onClick={() => {
                            setRefundForm({
                              customerId: a.customerId || '',
                              customerName: a.customerName || '',
                              advanceVoucherId: a.voucherNo || a.paymentNumber || '',
                              amount: String(a.balance || a.amount || ''),
                              paymentMethod: 'Cash',
                              paymentDate: formatBusinessDate(),
                              referenceNumber: a.voucherNo || a.paymentNumber || '',
                              notes: `Refund payout for advance voucher ${a.voucherNo}`,
                            });
                            setShowRecordRefundModal(true);
                          }}
                          style={{ padding: '4px 8px', color: '#dc2626' }}
                          title="Issue refund from this customer advance deposit"
                        ><RotateCcw size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdvances.length === 0 && (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>
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
      {/* TAB 3: REFUNDS (Customer Advance & Invoice Return Refunds) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'refunds' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', flexShrink: 0 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Refunds Issued
              </div>
              <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#dc2626', marginTop: '4px', fontFamily: 'monospace' }}>
                Rs. {totalRefundsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Refund Transactions
              </div>
              <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {filteredRefunds.length}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Customer Advance Deposits Pool
              </div>
              <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'monospace' }}>
                Rs. {advances.reduce((s, a) => s + Number(a.balance || a.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <input className="erp-field"
                type="text"
                placeholder="Search refunds by voucher #, customer, or reference number..."
                value={refundSearchQuery}
                onChange={(e) => setRefundSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
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
              {refundSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRefundSearchQuery('')}
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

            {/* Filter Method & Export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={15} color="#64748b" />
                <select className="erp-field"
                  value={refundMethodFilter}
                  onChange={(e) => setRefundMethodFilter(e.target.value)}
                  style={{
                    height: '38px',
                    padding: '0 8px',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              {refundSearchQuery && (
                <button className="erp-button"
                  type="button"
                  onClick={() => setRefundSearchQuery('')}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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
                onClick={handleExportRefundsCSV}
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
                title="Export refunds to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--erp-text-field)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>REFUND VOUCHER #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SOURCE / REFERENCE</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>REFUND AMOUNT</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>NOTES / REASON</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefunds.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
                        {r.refundNo}
                      </td>
                      <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{r.customerName}</td>
                      <td className="erp-table-cell" style={{ color: '#64748b' }}>
                        {r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="erp-table-cell" style={{ color: '#334155', fontFamily: 'monospace', fontSize: 'var(--erp-text-small)' }}>
                        {r.referenceNumber || 'Direct Refund'}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                        LKR {Number(r.amount || 0).toFixed(2)}
                      </td>
                      <td className="erp-table-cell" style={{ color: '#334155' }}>{r.paymentMethod}</td>
                      <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="erp-table-cell" style={{ color: '#64748b', fontSize: 'var(--erp-text-small)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>
                        {r.notes || '—'}
                      </td>
                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button aria-label="Print Refund Voucher"
                          type="button"
                          className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                          onClick={() => {
                            addToast(`Refund voucher ${r.refundNo} preview printed`, 'info');
                            window.print();
                          }}
                          style={{ padding: '4px 8px' }}
                          title="Print Refund Voucher"
                        ><Printer size={13} /></button>
                        {r.status !== 'VOIDED' && canEditPayment && (
                          <button aria-label="Void Refund"
                            type="button"
                            className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                            onClick={() => handleVoidRefund(r)}
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            title="Void Refund Voucher"
                          ><X size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRefunds.length === 0 && (
                    <tr>
                      <td className="erp-table-cell" colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '36px 12px' }}>
                        {loadingRefunds ? 'Loading customer refunds...' : 'No refund records found matching your search.'}
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
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Outstanding Balance
              </div>
              <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#dc2626', marginTop: '4px', fontFamily: 'monospace' }}>
                Rs. {totalOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending / Partial Invoices
              </div>
              <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {outstandingInvoices.length}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Settlement
              </div>
              <div style={{ fontSize: 'var(--erp-text-field)', color: '#475569', marginTop: '6px' }}>
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
              <input className="erp-field"
                type="text"
                placeholder="Search outstanding invoices by #, customer, or payment method..."
                value={outstandingSearchQuery}
                onChange={(e) => setOutstandingSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
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
              <select className="erp-field"
                value={outstandingStatusFilter}
                onChange={(e) => setOutstandingStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
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
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setOutstandingSearchQuery('');
                    setOutstandingStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--erp-text-field)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT TYPE</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAID</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BALANCE</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={9} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <CheckCircle size={34} style={{ opacity: 0.35, marginBottom: '8px', color: '#16a34a' }} />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: 'var(--erp-text-button)' }}>No outstanding invoices!</div>
                        <div style={{ fontSize: 'var(--erp-text-small)', color: '#94a3b8', marginTop: '3px' }}>
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
                        <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                          {inv.customerName}
                        </td>
                        <td className="erp-table-cell" style={{ color: '#64748b' }}>
                          {inv.displayDate || inv.invoiceDate}
                        </td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>
                          {inv.paymentType}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                          Rs. {invoiceTotal(inv).toFixed(2)}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.paidAmount || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.balanceAmount || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button aria-label="Record payment against this invoice" className="erp-button erp-button-primary erp-table-icon-action"
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
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                              }}
                              title="Record payment against this invoice"
                            ><Plus size={12} /></button>
                            <button aria-label="View invoice details"
                              type="button"
                              className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                              onClick={() => setSelectedInvoice(inv)}
                              style={{ padding: '4px 7px' }}
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
              <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a', fontWeight: 800 }}>Record Payment Receipt</h3>
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
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input className="erp-field"
                  type="text"
                  required
                  placeholder="e.g. Negombo Motors"
                  value={paymentForm.customerName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Invoice # (Optional)</label>
                  <input className="erp-field"
                    type="text"
                    placeholder="e.g. INV-2026-000001"
                    value={paymentForm.invoiceNo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoiceNo: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Date</label>
                  <input className="erp-field"
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Amount (LKR) *</label>
                  <input className="erp-field"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select className="erp-field"
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <textarea className="erp-field"
                  rows={2}
                  placeholder="Payment notes or cheque details..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => setShowRecordPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary erp-button erp-button-primary"
                  style={{ borderColor: '#0284c7' }}
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
              <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a', fontWeight: 800 }}>Record Advance Payment</h3>
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
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Voucher #</label>
                  <input className="erp-field"
                    type="text"
                    readOnly
                    value="[Auto-generated by backend]"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
                  <input className="erp-field"
                    type="date"
                    value={advanceForm.paymentDate}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input className="erp-field"
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering Ltd"
                  value={advanceForm.customerName}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Advance Amount (LKR) *</label>
                  <input className="erp-field"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={advanceForm.amount}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select className="erp-field"
                    value={advanceForm.paymentMethod}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes / Remarks</label>
                <textarea className="erp-field"
                  rows={2}
                  placeholder="Deposit notes / project reference..."
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => setShowRecordAdvanceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary erp-button erp-button-primary"
                  style={{ borderColor: '#0284c7' }}
                >
                  Save Advance Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Process Customer Refund */}
      {/* ------------------------------------------------------------- */}
      {showRecordRefundModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCcw size={18} color="#dc2626" /> Process Customer Refund
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
                  Refund customer advance payments or returned invoice credit to cash/bank
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordRefundModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRefund} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Refund Voucher #</label>
                  <input className="erp-field"
                    type="text"
                    readOnly
                    value="[Auto-generated: RFD-...]"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Refund Date</label>
                  <input className="erp-field"
                    type="date"
                    value={refundForm.paymentDate}
                    onChange={(e) => setRefundForm({ ...refundForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Customer selection */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Select Customer *</label>
                {customersList.length > 0 ? (
                  <select
                    className="erp-field"
                    required
                    value={refundForm.customerName}
                    onChange={(e) => {
                      const selCust = customersList.find((c) => c.name === e.target.value);
                      const custName = e.target.value;
                      const cId = selCust ? selCust.id : '';
                      const customerAdvs = advances.filter(
                        (a) => (cId && a.customerId === cId) || (a.customerName && a.customerName.toLowerCase() === custName.toLowerCase())
                      );
                      const advSum = customerAdvs.reduce((sum, a) => sum + Number(a.balance || a.amount || 0), 0);
                      setRefundForm({
                        ...refundForm,
                        customerName: custName,
                        customerId: cId,
                        amount: advSum > 0 ? String(advSum) : refundForm.amount,
                        referenceNumber: customerAdvs[0]?.voucherNo || refundForm.referenceNumber,
                        advanceVoucherId: customerAdvs[0]?.voucherNo || '',
                      });
                    }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.code || c.customerCode || `#${c.id}`})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="erp-field"
                    type="text"
                    required
                    placeholder="Enter customer name..."
                    value={refundForm.customerName}
                    onChange={(e) => setRefundForm({ ...refundForm, customerName: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Customer Available Advances Box */}
              {refundForm.customerName && (() => {
                const customerAdvs = advances.filter(
                  (a) => (refundForm.customerId && a.customerId === refundForm.customerId) || (a.customerName && a.customerName.toLowerCase() === refundForm.customerName.toLowerCase())
                );
                const totalAdv = customerAdvs.reduce((sum, a) => sum + Number(a.balance || a.amount || 0), 0);
                return (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: totalAdv > 0 ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${totalAdv > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                      fontSize: 'var(--erp-text-small)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: totalAdv > 0 ? '#166534' : '#475569' }}>
                        Customer Available Advance Deposits:
                      </span>
                      <strong style={{ color: totalAdv > 0 ? '#15803d' : '#64748b', fontSize: 'var(--erp-text-field)' }}>
                        LKR {totalAdv.toFixed(2)}
                      </strong>
                    </div>
                    {customerAdvs.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Active vouchers for this customer:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {customerAdvs.map((adv) => (
                            <button
                              key={adv.id}
                              type="button"
                              className="btn btn-sm btn-glass erp-button"
                              style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                border: refundForm.advanceVoucherId === adv.voucherNo ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                background: refundForm.advanceVoucherId === adv.voucherNo ? '#e0f2fe' : '#ffffff',
                              }}
                              onClick={() => {
                                setRefundForm({
                                  ...refundForm,
                                  advanceVoucherId: adv.voucherNo,
                                  referenceNumber: adv.voucherNo,
                                  amount: String(adv.balance || adv.amount || ''),
                                  notes: `Refund from advance voucher ${adv.voucherNo}`,
                                });
                              }}
                            >
                              {adv.voucherNo} (LKR {Number(adv.balance || adv.amount || 0).toFixed(2)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Refund Amount (LKR) *</label>
                  <input className="erp-field"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#dc2626', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Refund Payout Method</label>
                  <select className="erp-field"
                    value={refundForm.paymentMethod}
                    onChange={(e) => setRefundForm({ ...refundForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online / Gateway</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Original Reference / Return #</label>
                <input className="erp-field"
                  type="text"
                  placeholder="e.g. ADV-2026-0001 or RTN-2026-0001 or Cheque #"
                  value={refundForm.referenceNumber}
                  onChange={(e) => setRefundForm({ ...refundForm, referenceNumber: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Refund Notes / Reason</label>
                <textarea className="erp-field"
                  rows={2}
                  placeholder="Reason for refund (e.g. Customer returned items from invoice or requested advance payout)..."
                  value={refundForm.notes}
                  onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => setShowRecordRefundModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRefund}
                  className="btn btn-primary erp-button erp-button-primary"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                >
                  {isSavingRefund ? 'Processing...' : 'Complete Refund Payout'}
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
                    <h3 style={{ margin: 0, fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#0f172a' }}>COMMERCIAL INVOICE</h3>
                    <div style={{ fontSize: 'var(--erp-text-field)', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedInvoice.invoiceNumber}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 'var(--erp-text-small)',
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
                <span style={{ fontSize: 'var(--erp-text-caption)', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Billed Customer</span>
                <div style={{ fontWeight: 800, fontSize: 'var(--erp-text-nav)', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.customerName || 'Walk-in Customer'}
                </div>
                <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '2px' }}>
                  Payment: <strong style={{ color: '#334155' }}>{selectedInvoice.paymentType || 'Full Payment'} ({selectedInvoice.paymentMethod || 'Cash'})</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--erp-text-caption)', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Invoice Date & Time</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-nav)', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.displayDate || selectedInvoice.invoiceDate || new Date().toLocaleDateString()}
                </div>
                <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '2px' }}>
                  Salesman: <strong style={{ color: '#334155' }}>{selectedInvoice.salesman || 'Sales Executive'}</strong>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--erp-text-nav)', color: '#0f172a', fontWeight: 700 }}>
                  INVOICED LINE ITEMS ({selectedInvoiceItems.length})
                </h4>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div className="erp-table-frame erp-table-scroll"><table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--erp-text-field)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th className="erp-table-heading" style={{ width: '38px', textAlign: 'center' }}>#</th>
                      <th className="erp-table-heading" style={{ width: '130px' }}>SKU / CODE</th>
                      <th className="erp-table-heading">PRODUCT / DESCRIPTION</th>
                      <th className="erp-table-heading" style={{ width: '60px', textAlign: 'center' }}>QTY</th>
                      <th className="erp-table-heading" style={{ width: '110px', textAlign: 'right' }}>UNIT PRICE</th>
                      <th className="erp-table-heading" style={{ width: '120px', textAlign: 'right' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="erp-table-cell" style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td className="erp-table-cell erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {item.code || item.productSku || item.sku || '-'}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#1e293b' }}>
                          {item.name || item.productName || 'Product item'}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {item.quantity || 1}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                          LKR {(Number(item.unitPrice) || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          LKR {(Number(item.totalPrice || (item.quantity * item.unitPrice)) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {selectedInvoiceItems.length === 0 && (
                      <tr>
                        <td className="erp-table-cell" colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                          No line items recorded for this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table></div>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <div style={{ width: '100%', maxWidth: '340px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--erp-text-button)' }}>
                  <span style={{ color: '#64748b' }}>Gross Total</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    LKR {Number(selectedInvoice.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--erp-text-button)' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Amount Settled</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                    LKR {Number(selectedInvoice.paidAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: 'var(--erp-text-nav)' }}>
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
                className="btn btn-glass erp-button"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary erp-button erp-button-primary"
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
                style={{ borderColor: '#0284c7' }}
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
