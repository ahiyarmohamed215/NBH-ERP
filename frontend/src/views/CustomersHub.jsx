import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  customerApi,
  salesmanApi,
  userApi,
  salesApi,
  customerGroupApi,
  routeApi,
  pdfApi,
  paymentApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
import { useDataSync } from '../hooks/useDataSync';
import { printA4Report } from '../utils/printReport';
import {
  Users,
  UserCheck,
  Plus,
  Edit2,
  Search,
  RefreshCw,
  X,
  CheckCircle,
  MapPin,
  FileText,
  DollarSign,
  Phone,
  Mail,
  Building,
  Navigation,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  Table,
  ListFilter,
  Upload,
  Download,
  ArrowLeft,
  History,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  Receipt,
  Calendar,
  CreditCard,
  ChevronRight,
  Eye,
  Target,
} from 'lucide-react';
import CustomerTargetsTab from './CustomerTargetsTab';

export default function CustomersHub({ activeSubTab = 'list', onSubTabChange }) {
  const { user } = useAuth();
  const canEditCustomer = canEditModule(user, 'CUSTOMER');
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(() => {
    if (activeSubTab === 'groups' || activeSubTab === 'routes') return 'groups';
    if (activeSubTab === 'targets' || activeSubTab === 'ranges') return 'targets';
    if (activeSubTab === 'history') return 'history';
    return 'list';
  });

  // Data states
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(false);

  // Customer List Filters (Defaults to ALL so all statuses and all groups are shown by default)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [groupFilter, setGroupFilter] = useState('ALL'); // 'ALL' | groupId

  // Customer Status Change Confirmation Modal
  const [confirmStatusModal, setConfirmStatusModal] = useState({
    isOpen: false,
    customer: null,
  });

  // Customer Add/Edit Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: '0',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);

  // Customer History State
  const [selectedHistoryCustomerId, setSelectedHistoryCustomerId] = useState('');
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const [historyTableTab, setHistoryTableTab] = useState('invoices'); // 'invoices' | 'advances' | 'payments' | 'cheques' | 'outstanding'

  // Per-table search and filter states
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');

  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('ALL');

  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  const [chequeSearchQuery, setChequeSearchQuery] = useState('');
  const [chequeStatusFilter, setChequeStatusFilter] = useState('ALL');

  const [outstandingSearchQuery, setOutstandingSearchQuery] = useState('');
  const [outstandingStatusFilter, setOutstandingStatusFilter] = useState('ALL');

  const [previewModalDoc, setPreviewModalDoc] = useState(null);

  // Routes / Groups State
  const [routes, setRoutes] = useState([]);

  // Inline Route View state (replaces all popups for Groups & Routes)
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeModalMode, setRouteModalMode] = useState('view'); // 'view' or 'edit'
  const [groupStatusFilter, setGroupStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [routeEditForm, setRouteEditForm] = useState({
    name: '',
    routeCode: '',
    description: '',
    salesmanId: '',
    isActive: true,
    selectedCustomerIds: [],
  });
  const [customerSearchInRoute, setCustomerSearchInRoute] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');

  // Staff search state in group edit form
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isStaffSearchOpen, setIsStaffSearchOpen] = useState(false);
  const staffSearchRef = useRef(null);

  // Inline customer search & add state (No separate modal popup)
  const [inlineCustomerSearch, setInlineCustomerSearch] = useState('');
  const [isInlineCustomerSearchOpen, setIsInlineCustomerSearchOpen] = useState(false);
  const inlineCustomerSearchRef = useRef(null);

  // Sync subTab prop
  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(
        activeSubTab === 'groups' || activeSubTab === 'routes'
          ? 'groups'
          : activeSubTab === 'targets' || activeSubTab === 'ranges'
            ? 'targets'
            : activeSubTab === 'history'
              ? 'history'
              : 'list'
      );
    }
  }, [activeSubTab]);


  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsCustomerSearchOpen(false);
      }
      if (staffSearchRef.current && !staffSearchRef.current.contains(e.target)) {
        setIsStaffSearchOpen(false);
      }
      if (inlineCustomerSearchRef.current && !inlineCustomerSearchRef.current.contains(e.target)) {
        setIsInlineCustomerSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes, uRes, rRes] = await Promise.allSettled([
        customerApi.getAll(),
        salesmanApi.getAll(),
        userApi.getAll({ page: 0, size: 200 }),
        customerGroupApi.getAll(true),
      ]);

      let loadedCustomers = [];
      if (cRes.status === 'fulfilled') {
        loadedCustomers = cRes.value.data || cRes.value || [];
        setCustomers(loadedCustomers);
      }

      const rawSalesmen = sRes.status === 'fulfilled' ? (sRes.value.data || sRes.value || []) : [];
      const rawUsers = uRes.status === 'fulfilled' ? (uRes.value.data?.content || uRes.value.data || uRes.value || []) : [];

      // Combine all employees and staff members so ANY responsible staff (sales reps, delivery officers, drivers, managers, etc.) can be assigned
      const combinedStaff = [];
      const seen = new Set();

      rawUsers.forEach((u) => {
        const name = u.fullName || u.username;
        if (name && !seen.has(String(u.id))) {
          seen.add(String(u.id));
          const roles = Array.isArray(u.roles)
            ? u.roles.map((r) => (typeof r === 'string' ? r.replace('ROLE_', '') : r?.name?.replace('ROLE_', ''))).join(', ')
            : '';
          combinedStaff.push({
            id: String(u.id),
            name: name,
            salesmanCode: u.employeeCode || u.username || 'EMP',
            role: roles || 'Staff Member',
            phone: u.phone || '',
          });
        }
      });

      rawSalesmen.forEach((s) => {
        const name = s.name || s.fullName;
        if (name && !seen.has(String(s.id))) {
          seen.add(String(s.id));
          combinedStaff.push({
            id: String(s.id),
            name: name,
            salesmanCode: s.salesmanCode || s.code || 'REP',
            role: 'Sales Representative',
            phone: s.phone || '',
          });
        }
      });

      setSalesmen(combinedStaff);

      // Load customer groups from backend
      if (rRes.status === 'fulfilled') {
        const rawGroups = Array.isArray(rRes.value?.data)
          ? rRes.value.data
          : (Array.isArray(rRes.value) ? rRes.value : []);
        const loadedGroups = rawGroups.map((r) => ({
          id: r.id,
          name: r.groupName || r.routeName || r.name,
          groupName: r.groupName || r.routeName || r.name,
          routeName: r.groupName || r.routeName || r.name,
          groupCode: r.groupCode || r.routeCode || '',
          routeCode: r.groupCode || r.routeCode || '',
          description: r.description || '',
          isActive: r.isActive !== undefined ? r.isActive : true,
          salesmanId: r.assignedStaffId || r.salesRepId ? String(r.assignedStaffId || r.salesRepId) : '',
          salesmanName: r.assignedStaffName || r.salesRepName || '',
          assignedStaffId: r.assignedStaffId || r.salesRepId ? String(r.assignedStaffId || r.salesRepId) : '',
          assignedStaffName: r.assignedStaffName || r.salesRepName || '',
          customerIds: (r.customerIds || []).map(String),
          createdAt: r.createdAt || new Date().toISOString(),
        }));
        setRoutes(loadedGroups);
      }
    } catch (err) {
      addToast('Error loading data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial load & automatic tab switch synchronization
  useEffect(() => {
    loadInitialData();
  }, [activeTab]);

  useDataSync(loadInitialData, [
    'erp:data_changed',
    'erp:customers_updated',
    'erp:roles_updated',
    'erp:users_updated',
  ]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // Helper to find all customer groups a customer belongs to (Active only)
  const getCustomerRoutes = (customerId) => {
    const cid = String(customerId);
    const cObj = customers.find((c) => String(c.id) === cid);
    const activeRoutes = routes.filter((r) => r.isActive !== false);
    const routesByArray = activeRoutes.filter((r) =>
      Array.isArray(r.customerIds) && r.customerIds.some((id) => String(id) === cid)
    );
    const directGroupIds = [
      ...(Array.isArray(cObj?.customerGroupIds) ? cObj.customerGroupIds : []),
      ...(Array.isArray(cObj?.routeIds) ? cObj.routeIds : []),
      ...(cObj?.customerGroupId ? [cObj.customerGroupId] : []),
      ...(cObj?.routeId ? [cObj.routeId] : []),
    ].map(String);

    const directRoutes = activeRoutes.filter((r) => directGroupIds.includes(String(r.id)));
    const combined = [...directRoutes, ...routesByArray];
    return Array.from(new Map(combined.map((r) => [String(r.id), r])).values());
  };

  // Helper for single customer group fallback (Active only)
  const getCustomerRoute = (customerId) => {
    const assigned = getCustomerRoutes(customerId);
    if (assigned.length > 0) return assigned[0];
    const cid = String(customerId);
    const cObj = customers.find((c) => String(c.id) === cid);
    const groupId = cObj?.customerGroupId || cObj?.routeId;
    if (groupId) {
      const g = routes.find((r) => String(r.id) === String(groupId));
      if (g && g.isActive === false) return null;
    }
    const groupName = cObj?.customerGroupName || cObj?.routeName;
    if (groupName) {
      const gByName = routes.find((r) => (r.name || '').trim().toLowerCase() === groupName.trim().toLowerCase());
      if (gByName && gByName.isActive === false) return null;
      return { id: groupId, name: groupName, groupName: groupName, groupCode: cObj.customerGroupCode || cObj.routeCode || '', routeCode: cObj.customerGroupCode || cObj.routeCode || '' };
    }
    return null;
  };

  const isCustomerActive = (c) => Boolean(c?.isActive ?? c?.active ?? false);

  const handleSelectCustomerForHistory = (c) => {
    if (!c) {
      setSelectedHistoryCustomerId('');
      setCustomerSearchInput('');
    } else {
      setSelectedHistoryCustomerId(String(c.id));
      setCustomerSearchInput(c.name || '');
    }
    setIsCustomerSearchOpen(false);
  };

  const handleViewCustomerHistory = (customer) => {
    if (customer && customer.id) {
      handleSelectCustomerForHistory(customer);
      handleTabChange('history');
    }
  };

  // Currently selected customer for history
  const selectedHistoryCustomer = useMemo(() => {
    if (!selectedHistoryCustomerId) return null;
    return customers.find((c) => String(c.id) === String(selectedHistoryCustomerId)) || null;
  }, [customers, selectedHistoryCustomerId]);

  // Filtered customer list for the Customer History top selector (Only ACTIVE customers)
  const filteredHistoryCustomerOptions = useMemo(() => {
    const activeCustomers = customers.filter((c) => isCustomerActive(c));
    const q = customerSearchInput.toLowerCase().trim();
    if (!q || (selectedHistoryCustomer && q === (selectedHistoryCustomer.name || '').toLowerCase().trim())) {
      return activeCustomers;
    }
    return activeCustomers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const code = (c.code || c.customerCode || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      const route = getCustomerRoute(c.id)?.name?.toLowerCase() || '';
      return name.includes(q) || code.includes(q) || phone.includes(q) || address.includes(q) || route.includes(q);
    });
  }, [customers, customerSearchInput, selectedHistoryCustomer, routes]);

  const matchesCustomer = (itemCustomerId, itemCustomerName, itemCustomerCode) => {
    if (!selectedHistoryCustomer) return false;
    const cId = String(selectedHistoryCustomer.id);
    const cName = (selectedHistoryCustomer.name || '').trim().toLowerCase();
    const cCode = (selectedHistoryCustomer.code || selectedHistoryCustomer.customerCode || '').trim().toLowerCase();

    if (itemCustomerId && String(itemCustomerId) === cId) return true;
    if (itemCustomerCode && cCode && String(itemCustomerCode).trim().toLowerCase() === cCode) return true;
    if (!itemCustomerName) return false;
    const rawName = String(itemCustomerName).trim().toLowerCase();
    if (rawName === cName) return true;
    if (cName && (rawName.includes(cName) || cName.includes(rawName))) return true;
    return false;
  };

  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!selectedHistoryCustomer?.id) {
      setHistoryInvoices([]);
      setHistoryPayments([]);
      return;
    }
    const loadCustomerFinancialHistory = async () => {
      try {
        setLoadingHistory(true);
        const [invRes, pmtRes] = await Promise.all([
          salesApi.search({ customerId: selectedHistoryCustomer.id, size: 200 }).catch(() => ({ data: [] })),
          paymentApi.search({ customerId: selectedHistoryCustomer.id, size: 200 }).catch(() => ({ data: [] })),
        ]);
        const invList = invRes.data?.content || invRes.data || [];
        const pmtList = pmtRes.data?.content || pmtRes.data || [];
        setHistoryInvoices(invList);
        setHistoryPayments(pmtList);
      } catch (err) {
        console.error('Failed to load customer financial history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadCustomerFinancialHistory();
  }, [selectedHistoryCustomer?.id]);

  // Raw Customer Invoices (from real backend API)
  const rawCustomerInvoices = historyInvoices;

  // Filtered Customer Invoices
  const filteredCustomerInvoices = useMemo(() => {
    return rawCustomerInvoices.filter((inv) => {
      if (invoiceStatusFilter !== 'ALL') {
        if ((inv.status || '').toUpperCase() !== invoiceStatusFilter.toUpperCase()) return false;
      }
      if (invoiceSearchQuery.trim()) {
        const q = invoiceSearchQuery.toLowerCase().trim();
        const num = (inv.invoiceNumber || inv.id || '').toLowerCase();
        const pt = (inv.paymentType || '').toLowerCase();
        const pm = (inv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !pt.includes(q) && !pm.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerInvoices, invoiceStatusFilter, invoiceSearchQuery]);

  // Raw Customer Advance Payments (from real backend payments with ADVANCE type or unallocated)
  const rawCustomerAdvances = useMemo(() => {
    return historyPayments.filter((p) => p.paymentType === 'ADVANCE' || !p.invoiceNumber);
  }, [historyPayments]);

  // Filtered Customer Advance Payments
  const filteredCustomerAdvances = useMemo(() => {
    return rawCustomerAdvances.filter((adv) => {
      if (advanceStatusFilter !== 'ALL') {
        if ((adv.status || '').toUpperCase() !== advanceStatusFilter.toUpperCase()) return false;
      }
      if (advanceSearchQuery.trim()) {
        const q = advanceSearchQuery.toLowerCase().trim();
        const num = (adv.voucherNo || adv.paymentNumber || adv.id || '').toLowerCase();
        const pm = (adv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !pm.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerAdvances, advanceStatusFilter, advanceSearchQuery]);

  // Raw Customer Payments (from real backend payments)
  const rawCustomerPayments = useMemo(() => {
    return historyPayments.filter((p) => p.paymentType !== 'ADVANCE' && p.invoiceNumber);
  }, [historyPayments]);

  // Filtered Customer Payments
  const filteredCustomerPayments = useMemo(() => {
    return rawCustomerPayments.filter((pmt) => {
      if (paymentStatusFilter !== 'ALL') {
        if ((pmt.status || '').toUpperCase() !== paymentStatusFilter.toUpperCase()) return false;
      }
      if (paymentSearchQuery.trim()) {
        const q = paymentSearchQuery.toLowerCase().trim();
        const rec = (pmt.receiptNo || pmt.paymentNumber || pmt.id || '').toLowerCase();
        const inv = (pmt.invoiceNo || pmt.invoiceNumber || '').toLowerCase();
        const pm = (pmt.paymentMethod || '').toLowerCase();
        if (!rec.includes(q) && !inv.includes(q) && !pm.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerPayments, paymentStatusFilter, paymentSearchQuery]);

  // Raw Customer Cheques (from real backend payments with paymentMethod === CHEQUE)
  const rawCustomerCheques = useMemo(() => {
    return historyPayments.filter((p) => (p.paymentMethod || '').toUpperCase() === 'CHEQUE');
  }, [historyPayments]);

  // Filtered Customer Cheques
  const filteredCustomerCheques = useMemo(() => {
    return rawCustomerCheques.filter((chq) => {
      if (chequeStatusFilter !== 'ALL') {
        if ((chq.status || '').toUpperCase() !== chequeStatusFilter.toUpperCase()) return false;
      }
      if (chequeSearchQuery.trim()) {
        const q = chequeSearchQuery.toLowerCase().trim();
        const num = (chq.chequeNo || chq.id || '').toLowerCase();
        const bnk = (chq.bankName || '').toLowerCase();
        const inv = (chq.invoiceNo || '').toLowerCase();
        if (!num.includes(q) && !bnk.includes(q) && !inv.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerCheques, chequeStatusFilter, chequeSearchQuery]);

  // Raw Customer Outstanding (Invoices with balanceAmount > 0)
  const rawCustomerOutstanding = useMemo(() => {
    return rawCustomerInvoices.filter((inv) => Number(inv.balanceAmount || 0) > 0);
  }, [rawCustomerInvoices]);

  // Filtered Customer Outstanding
  const filteredCustomerOutstanding = useMemo(() => {
    return rawCustomerOutstanding.filter((inv) => {
      if (outstandingStatusFilter !== 'ALL') {
        if ((inv.status || '').toUpperCase() !== outstandingStatusFilter.toUpperCase()) return false;
      }
      if (outstandingSearchQuery.trim()) {
        const q = outstandingSearchQuery.toLowerCase().trim();
        const num = (inv.invoiceNumber || inv.id || '').toLowerCase();
        const pt = (inv.paymentType || '').toLowerCase();
        if (!num.includes(q) && !pt.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerOutstanding, outstandingStatusFilter, outstandingSearchQuery]);

  // Customer Financial Metrics
  const customerHistoryMetrics = useMemo(() => {
    if (!selectedHistoryCustomer) {
      return {
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        creditLimit: 0,
        creditAvailable: 0,
        creditUtilization: 0,
        totalAdvances: 0,
        invoiceCount: 0,
        paymentCount: 0,
        chequeCount: 0,
        outstandingCount: 0,
      };
    }

    const totalInvoiced = rawCustomerInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const totalPaidOnInvoices = rawCustomerInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
    const directReceipts = rawCustomerPayments.reduce((sum, pmt) => sum + Number(pmt.amount || 0), 0);
    const totalPaid = Math.max(totalPaidOnInvoices, directReceipts);
    const outstandingBalance = rawCustomerOutstanding.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);
    const totalAdvances = rawCustomerAdvances.reduce((sum, adv) => sum + Number(adv.amount || 0), 0);

    const creditLimit = Number(selectedHistoryCustomer.creditLimit || 0);
    const creditAvailable = Math.max(0, creditLimit - outstandingBalance);
    const creditUtilization = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : 0;

    return {
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      creditLimit,
      creditAvailable,
      creditUtilization,
      totalAdvances,
      invoiceCount: rawCustomerInvoices.length,
      paymentCount: rawCustomerPayments.length,
      chequeCount: rawCustomerCheques.length,
      outstandingCount: rawCustomerOutstanding.length,
    };
  }, [selectedHistoryCustomer, rawCustomerInvoices, rawCustomerPayments, rawCustomerOutstanding, rawCustomerAdvances, rawCustomerCheques]);

  // Export Customer Table CSV
  const handleExportTableCSV = (tabType) => {
    if (!selectedHistoryCustomer) {
      addToast('Please select a customer first', 'error');
      return;
    }

    const safeName = (selectedHistoryCustomer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    let headers = [];
    let rows = [];
    let filename = '';

    if (tabType === 'invoices') {
      headers = ['Invoice #', 'Date', 'Payment Type', 'Payment Method', 'Total Amount', 'Paid Amount', 'Balance', 'Status'];
      rows = filteredCustomerInvoices.map((inv) => [
        `"${inv.invoiceNumber || inv.id}"`,
        `"${inv.displayDate || inv.invoiceDate || ''}"`,
        `"${inv.paymentType || ''}"`,
        `"${inv.paymentMethod || ''}"`,
        Number(inv.totalAmount || 0).toFixed(2),
        Number(inv.paidAmount || 0).toFixed(2),
        Number(inv.balanceAmount || 0).toFixed(2),
        `"${inv.status || ''}"`,
      ]);
      filename = `Invoices_${safeName}`;
    } else if (tabType === 'advances') {
      headers = ['Voucher #', 'Date', 'Payment Method', 'Deposit Amount', 'Available Balance', 'Status'];
      rows = filteredCustomerAdvances.map((adv) => [
        `"${adv.voucherNo || adv.id}"`,
        `"${adv.displayDate || adv.date || ''}"`,
        `"${adv.paymentMethod || ''}"`,
        Number(adv.amount || 0).toFixed(2),
        Number(adv.balance || 0).toFixed(2),
        `"${adv.status || ''}"`,
      ]);
      filename = `Advance_Payments_${safeName}`;
    } else if (tabType === 'payments') {
      headers = ['Receipt #', 'Date', 'Invoice #', 'Payment Method', 'Amount Paid', 'Status'];
      rows = filteredCustomerPayments.map((pmt) => [
        `"${pmt.receiptNo || pmt.id}"`,
        `"${pmt.displayDate || pmt.paymentDate || ''}"`,
        `"${pmt.invoiceNo || ''}"`,
        `"${pmt.paymentMethod || ''}"`,
        Number(pmt.amount || 0).toFixed(2),
        `"${pmt.status || ''}"`,
      ]);
      filename = `Payments_${safeName}`;
    } else if (tabType === 'cheques') {
      headers = ['Cheque #', 'Cheque Date', 'Bank Name', 'Invoice / Ref #', 'Amount', 'Status'];
      rows = filteredCustomerCheques.map((chq) => [
        `"${chq.chequeNo || chq.id}"`,
        `"${chq.displayDate || chq.chequeDate || ''}"`,
        `"${chq.bankName || ''}"`,
        `"${chq.invoiceNo || ''}"`,
        Number(chq.amount || 0).toFixed(2),
        `"${chq.status || ''}"`,
      ]);
      filename = `Cheques_${safeName}`;
    } else if (tabType === 'outstanding') {
      headers = ['Invoice #', 'Date', 'Payment Type', 'Total Amount', 'Paid Amount', 'Outstanding Balance', 'Status'];
      rows = filteredCustomerOutstanding.map((inv) => [
        `"${inv.invoiceNumber || inv.id}"`,
        `"${inv.displayDate || inv.invoiceDate || ''}"`,
        `"${inv.paymentType || ''}"`,
        Number(inv.totalAmount || 0).toFixed(2),
        Number(inv.paidAmount || 0).toFixed(2),
        Number(inv.balanceAmount || 0).toFixed(2),
        `"${inv.status || ''}"`,
      ]);
      filename = `Outstanding_Payments_${safeName}`;
    }

    const titleRows = [
      `"${tabType.toUpperCase()} - ${selectedHistoryCustomer.name.toUpperCase()}"`,
      `"Customer Code: ${selectedHistoryCustomer.code || selectedHistoryCustomer.customerCode || '—'}"`,
      `"Export Date: ${new Date().toLocaleDateString()}"`,
      '',
    ];

    const csvContent = [...titleRows, headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`${tabType} exported to CSV`, 'success');
  };

  // Export Customer Statement CSV (used by header action button)
  const handleExportCustomerStatementCSV = () => {
    if (!selectedHistoryCustomer) {
      addToast('Please select a customer first', 'error');
      return;
    }
    handleExportTableCSV(historyTableTab);
  };

  // Filtered customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const active = isCustomerActive(c);
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'INACTIVE' && active) return false;

      const cRoutes = getCustomerRoutes(c.id);

      if (groupFilter !== 'ALL') {
        const matchesGroup =
          cRoutes.some((r) => String(r.id) === String(groupFilter)) ||
          String(c.customerGroupId || c.routeId) === String(groupFilter) ||
          (Array.isArray(c.customerGroupIds) && c.customerGroupIds.some((id) => String(id) === String(groupFilter))) ||
          (Array.isArray(c.routeIds) && c.routeIds.some((id) => String(id) === String(groupFilter)));
        if (!matchesGroup) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (c.code || c.customerCode || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        const contact = (c.contactPerson || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const routeNames = cRoutes.map((r) => r.name.toLowerCase()).join(' ');
        if (!code.includes(q) && !name.includes(q) && !contact.includes(q) && !phone.includes(q) && !email.includes(q) && !routeNames.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [customers, statusFilter, groupFilter, searchTerm, routes]);

  // Filtered Routes based on route search term and status filter
  const filteredRoutes = useMemo(() => {
    let list = routes;
    if (groupStatusFilter === 'active') {
      list = list.filter((r) => r.isActive !== false);
    } else if (groupStatusFilter === 'inactive') {
      list = list.filter((r) => r.isActive === false);
    }
    const q = routeSearchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const assignedSalesman = salesmen.find((s) => String(s.id) === String(r.salesmanId || r.assignedStaffId));
      const repName = (r.assignedStaffName || r.salesmanName || assignedSalesman?.name || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const code = (r.groupCode || r.routeCode || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return name.includes(q) || code.includes(q) || repName.includes(q) || desc.includes(q);
    });
  }, [routes, routeSearchTerm, groupStatusFilter, salesmen]);

  // Customer Toggle Active
  const handleToggleCustomerActive = async (id, currentStatus) => {
    try {
      await customerApi.toggleActive(id);
      addToast(`Status changed to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
      loadInitialData();
    } catch (err) {
      addToast('Failed to update status: ' + err.message, 'error');
    }
  };

  // Open Add Customer Modal
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({
      code: '',
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      creditLimit: '0',
    });
    setShowCustomerModal(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (c) => {
    setEditingCustomer(c);
    setCustomerForm({
      code: c.code || c.customerCode || '',
      name: c.name || '',
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '0',
    });
    setShowCustomerModal(true);
  };

  // Save Customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (editingCustomer && !canEditCustomer) {
      addToast('Permission denied: Only authorized staff can edit existing customer records.', 'error');
      return;
    }
    if (!customerForm.name.trim()) {
      addToast('Customer Name is required', 'error');
      return;
    }

    try {
      setSavingCustomer(true);
      const payload = {
        code: customerForm.code.trim().toUpperCase() || undefined,
        customerCode: customerForm.code.trim().toUpperCase() || undefined,
        name: customerForm.name.trim(),
        contactPerson: customerForm.contactPerson.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim(),
        address: customerForm.address.trim(),
        creditLimit: parseFloat(customerForm.creditLimit) || 0,
      };

      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, payload);
        addToast('Customer updated successfully', 'success');
      } else {
        await customerApi.create(payload);
        addToast('Customer created successfully', 'success');
      }

      setShowCustomerModal(false);
      loadInitialData();
    } catch (err) {
      addToast(err.message || 'Failed to save customer', 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  // -------------------------------------------------------------
  // Route / Group Management Actions (Inline View - No Popups)
  // -------------------------------------------------------------
  const handleOpenRouteView = (route) => {
    setSelectedRoute(route);
    setIsCreatingRoute(false);
    setRouteModalMode('view'); // Show read-only view mode first, not edit mode
    const staffId = route.salesmanId || route.assignedStaffId || '';
    const st = salesmen.find((s) => String(s.id) === String(staffId));
    setRouteEditForm({
      name: route.name || route.routeName || '',
      routeCode: route.routeCode || route.groupCode || '',
      description: route.description || '',
      salesmanId: staffId,
      isActive: route.isActive !== false,
      selectedCustomerIds: route.customerIds ? [...route.customerIds] : [],
    });
    setStaffSearchQuery(st ? st.name : '');
    setIsStaffSearchOpen(false);
    setInlineCustomerSearch('');
    setIsInlineCustomerSearchOpen(false);
    setCustomerSearchInRoute('');
  };

  const handleOpenCreateRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(true);
    setRouteModalMode('edit');
    setRouteEditForm({
      name: '',
      routeCode: '',
      description: '',
      salesmanId: '',
      isActive: true,
      selectedCustomerIds: [],
    });
    setStaffSearchQuery('');
    setIsStaffSearchOpen(false);
    setInlineCustomerSearch('');
    setIsInlineCustomerSearchOpen(false);
    setCustomerSearchInRoute('');
  };

  const handleCloseRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(false);
    setRouteModalMode('view');
    setCustomerSearchInRoute('');
    setStaffSearchQuery('');
    setIsStaffSearchOpen(false);
    setInlineCustomerSearch('');
    setIsInlineCustomerSearchOpen(false);
  };

  const handleToggleRouteActive = async (route, e) => {
    if (e) e.stopPropagation();
    if (!canEditCustomer) {
      addToast('Permission denied: Only authorized staff can edit customer groups.', 'error');
      return;
    }
    try {
      const res = await customerGroupApi.toggleActive(route.id);
      const updatedDto = res.data?.data;
      const nextActive = (updatedDto && updatedDto.isActive !== undefined)
        ? Boolean(updatedDto.isActive)
        : !Boolean(route.isActive !== false);

      setRoutes((prev) =>
        prev.map((r) => (r.id === route.id ? { ...r, isActive: nextActive } : r))
      );
      if (selectedRoute && String(selectedRoute.id) === String(route.id)) {
        setSelectedRoute((prev) => ({ ...prev, isActive: nextActive }));
        setRouteEditForm((prev) => ({ ...prev, isActive: nextActive }));
      }
      addToast(
        `Customer group "${route.name}" is now ${nextActive ? 'Active' : 'Inactive'}.`,
        'success'
      );
    } catch (err) {
      addToast('Error toggling status: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleSaveRouteView = async (e) => {
    if (e) e.preventDefault();
    if (!isCreatingRoute && !canEditCustomer) {
      addToast('Permission denied: Only authorized staff can edit customer groups.', 'error');
      return;
    }
    if (!routeEditForm.name.trim()) {
      addToast('Customer group name is required', 'error');
      return;
    }

    const assignedSalesman = salesmen.find((s) => String(s.id) === String(routeEditForm.salesmanId));
    const salesmanName = assignedSalesman?.name || '';
    const staffIdNum = routeEditForm.salesmanId ? Number(routeEditForm.salesmanId) : null;
    const payload = {
      groupName: routeEditForm.name.trim(),
      routeName: routeEditForm.name.trim(),
      groupCode: routeEditForm.routeCode ? routeEditForm.routeCode.trim() : undefined,
      routeCode: routeEditForm.routeCode ? routeEditForm.routeCode.trim() : undefined,
      description: routeEditForm.description ? routeEditForm.description.trim() : '',
      assignedStaffId: staffIdNum,
      salesRepId: staffIdNum,
      isActive: routeEditForm.isActive !== false,
      customerIds: (routeEditForm.selectedCustomerIds || []).map((id) => Number(id)).filter(Boolean),
    };

    try {
      if (isCreatingRoute) {
        const res = await customerGroupApi.create(payload);
        const created = res.data?.data || res.data || res;
        const assignedId = created.assignedStaffId || created.salesRepId;
        const normalized = {
          id: created.id,
          name: created.groupName || created.routeName || created.name,
          groupName: created.groupName || created.routeName || created.name,
          routeName: created.groupName || created.routeName || created.name,
          groupCode: created.groupCode || created.routeCode || '',
          routeCode: created.groupCode || created.routeCode || '',
          description: created.description || '',
          isActive: created.isActive !== undefined ? created.isActive : true,
          salesmanId: assignedId ? String(assignedId) : '',
          salesmanName: created.assignedStaffName || created.salesRepName || salesmanName,
          assignedStaffId: assignedId ? String(assignedId) : '',
          assignedStaffName: created.assignedStaffName || created.salesRepName || salesmanName,
          customerIds: (created.customerIds || []).map(String),
          createdAt: created.createdAt || new Date().toISOString(),
        };
        setRoutes((prev) => [...prev, normalized]);
        setSelectedRoute(normalized);
        setIsCreatingRoute(false);
        setRouteModalMode('view');
        addToast(`Customer group "${normalized.name}" created successfully!`, 'success');
      } else if (selectedRoute) {
        const res = await customerGroupApi.update(selectedRoute.id, payload);
        const updated = res.data?.data || res.data || res;
        const assignedId = updated.assignedStaffId || updated.salesRepId;
        const normalized = {
          id: updated.id,
          name: updated.groupName || updated.routeName || updated.name,
          groupName: updated.groupName || updated.routeName || updated.name,
          routeName: updated.groupName || updated.routeName || updated.name,
          groupCode: updated.groupCode || updated.routeCode || '',
          routeCode: updated.groupCode || updated.routeCode || '',
          description: updated.description || '',
          isActive: updated.isActive !== undefined ? updated.isActive : routeEditForm.isActive,
          salesmanId: assignedId ? String(assignedId) : '',
          salesmanName: updated.assignedStaffName || updated.salesRepName || salesmanName,
          assignedStaffId: assignedId ? String(assignedId) : '',
          assignedStaffName: updated.assignedStaffName || updated.salesRepName || salesmanName,
          customerIds: (updated.customerIds || []).map(String),
          createdAt: selectedRoute.createdAt || new Date().toISOString(),
        };
        setRoutes((prev) =>
          prev.map((r) => (r.id === selectedRoute.id ? normalized : r))
        );
        setSelectedRoute(normalized);
        setRouteModalMode('view');
        addToast(`Customer group "${normalized.name}" updated successfully!`, 'success');
      }
      loadInitialData();
    } catch (err) {
      addToast('Error saving customer group: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  // Assigned customers memo for Route View
  const assignedCustomerList = useMemo(() => {
    if (!selectedRoute && !isCreatingRoute) return [];
    const selectedSet = new Set((routeEditForm.selectedCustomerIds || []).map((id) => String(id)));
    let list = customers.filter((c) => selectedSet.has(String(c.id)));
    if (customerSearchInRoute.trim()) {
      const q = customerSearchInRoute.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q))
      );
    }
    return list;
  }, [customers, routeEditForm.selectedCustomerIds, customerSearchInRoute, selectedRoute, isCreatingRoute]);

  // Filtered staff list for searchable Staff Member autocomplete
  const filteredStaffList = useMemo(() => {
    const q = staffSearchQuery.trim().toLowerCase();
    if (!q) return salesmen;
    return salesmen.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const code = (s.salesmanCode || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return name.includes(q) || code.includes(q) || role.includes(q) || phone.includes(q);
    });
  }, [salesmen, staffSearchQuery]);

  // Currently assigned staff member object
  const currentAssignedStaff = useMemo(() => {
    if (!routeEditForm.salesmanId) return null;
    return salesmen.find((s) => String(s.id) === String(routeEditForm.salesmanId)) || null;
  }, [salesmen, routeEditForm.salesmanId]);

  // Available customers for inline customer search & assignment (ACTIVE only)
  const inlineCustomerSearchResults = useMemo(() => {
    const activeCustomers = customers.filter((c) => isCustomerActive(c));
    const q = inlineCustomerSearch.trim().toLowerCase();
    if (!q) {
      const assignedSet = new Set((routeEditForm.selectedCustomerIds || []).map(String));
      return activeCustomers.filter((c) => !assignedSet.has(String(c.id))).slice(0, 25);
    }
    return activeCustomers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [customers, inlineCustomerSearch, routeEditForm.selectedCustomerIds]);

  // Export CSV matching EmployeesHub style
  const handleExportCSV = () => {
    if (customers.length === 0) {
      addToast('No customers to export', 'error');
      return;
    }
    const headers = ['Code', 'Name', 'Customer Group', 'Contact Person', 'Phone', 'Email', 'Address', 'Credit Limit', 'Current Balance', 'Status'];
    const rows = (filteredCustomers.length > 0 ? filteredCustomers : customers).map((c) => {
      const assignedRoutes = getCustomerRoutes(c.id);
      const routeNames = assignedRoutes.map((r) => r.name).join('; ') || 'Unassigned';
      return [
        `"${(c.code || c.customerCode || '').replace(/"/g, '""')}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${routeNames.replace(/"/g, '""')}"`,
        `"${(c.contactPerson || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        c.creditLimit || 0,
        c.currentBalance || 0,
        isCustomerActive(c) ? 'Active' : 'Inactive',
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Customer list exported to CSV', 'success');
  };

  // Export Customer Groups to CSV
  const handleExportRoutesCSV = () => {
    if (routes.length === 0) {
      addToast('No customer groups to export', 'error');
      return;
    }
    const headers = ['Group Name', 'Group Code', 'Assigned Staff', 'Total Customers', 'Description', 'Created Date'];
    const rows = (filteredRoutes.length > 0 ? filteredRoutes : routes).map((r) => {
      const assignedStaff = salesmen.find((s) => String(s.id) === String(r.assignedStaffId || r.salesmanId));
      const repName = r.assignedStaffName || r.salesmanName || assignedStaff?.name || 'Unassigned';
      const count = r.customerIds?.length || 0;
      const createdDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—';
      return [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.groupCode || r.routeCode || '').replace(/"/g, '""')}"`,
        `"${repName.replace(/"/g, '""')}"`,
        count,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${createdDate}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customer_groups_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Customer groups exported to CSV', 'success');
  };

  const handlePrintCustomerGroupsReport = () => {
    const list = filteredRoutes.length > 0 ? filteredRoutes : routes;
    if (list.length === 0) {
      addToast('No customer groups to print', 'error');
      return;
    }
    printA4Report({
      title: 'Customer Groups Directory',
      subtitle: `Total Groups: ${list.length}`,
      metaItems: [
        { label: 'Date', value: new Date().toLocaleDateString() },
        { label: 'Filter', value: groupStatusFilter.toUpperCase() },
      ],
      columns: [
        { header: 'Group Name', accessor: 'name' },
        { header: 'Group Code', accessor: (r) => r.groupCode || r.routeCode || '—' },
        { header: 'Assigned Staff', accessor: (r) => {
          const assignedStaff = salesmen.find((s) => String(s.id) === String(r.assignedStaffId || r.salesmanId));
          return r.assignedStaffName || r.salesmanName || assignedStaff?.name || 'Unassigned';
        }},
        { header: 'Total Customers', accessor: (r) => String(r.customerIds?.length || 0), align: 'center' },
        { header: 'Status', accessor: (r) => (r.isActive !== false ? 'Active' : 'Inactive'), align: 'center' },
      ],
      data: list,
    });
  };

  const isFiltered = Boolean(searchTerm.trim() || statusFilter !== 'ALL' || groupFilter !== 'ALL');
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setGroupFilter('ALL');
  };

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
        fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Page Header (Fixed / Sticky to Desktop Screen) */}
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
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Customer Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Create and manage customer records, credit limits, customer groups, and transaction history.
          </p>
        </div>

        {activeTab !== 'history' && (
          <button
            type="button"
            onClick={handleOpenAddCustomer}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Add Customer
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching EmployeesHub - Fixed / Sticky) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('list')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'list' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'list' ? 700 : 500,
            color: activeTab === 'list' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <ListFilter size={16} /> Customer List
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('groups')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'groups' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'groups' ? 700 : 500,
            color: activeTab === 'groups' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Users size={16} /> Customer Groups
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('targets')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'targets' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'targets' ? 700 : 500,
            color: activeTab === 'targets' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Target size={16} /> Range & Targets
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('history')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'history' ? 700 : 500,
            color: activeTab === 'history' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <History size={16} /> Customer History
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Customer List View                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'list' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top Filter & Actions Bar (White Card Look - Matching Employees Page Theme) */}
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
              flexWrap: 'wrap',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Left Control: Search Input extending directly up to All Routes dropdown */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
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
                placeholder="Search customers by code, name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
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
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Filters (to the left of Export CSV), Export CSV (icon only), & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Customer Group Filter Dropdown */}
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 30px 0 12px',
                  width: '145px',
                  minWidth: '120px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.86rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
                }}
                title="Filter customers by customer group"
              >
                <option value="ALL">All Groups</option>
                {routes.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name || r.groupName || r.routeName}
                  </option>
                ))}
              </select>

              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 30px 0 12px',
                  width: '135px',
                  minWidth: '115px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.86rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
                }}
                title="Filter customers by status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              {/* Reset Filters button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV (Icon Only) */}
              <button
                type="button"
                onClick={handleExportCSV}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Export customers to CSV"
              >
                <Download size={14} />
              </button>

              {/* Print Customer Directory A4 (Icon Only) */}
              <button
                type="button"
                onClick={() => pdfApi.printCustomerList()}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Customer Directory (A4)"
              >
                <Printer size={14} />
              </button>

              {/* Refresh Customer Records (Icon Only) */}
              <button
                type="button"
                onClick={loadInitialData}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh customer records"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Customers Table (Fixed Table Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CUSTOMER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CUSTOMER GROUP
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CONTACT PERSON
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      PHONE NUMBER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ADDRESS
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CREDIT LIMIT
                    </th>

                    <th style={{ padding: '12px 12px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.875rem' }}>
                        Loading customer records...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', fontSize: '0.875rem' }}>
                        No customers found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const active = isCustomerActive(c);
                      const code = c.code || c.customerCode;
                      const assignedRoutes = getCustomerRoutes(c.id);

                      return (
                        <tr
                          key={c.id}
                          onClick={() => setViewingCustomer(c)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          title="Click row to view customer profile"
                        >
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: '#e0f2fe',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: '0.8125rem',
                                  border: '1px solid #bae6fd',
                                  flexShrink: 0,
                                }}
                              >
                                {(c.name || 'C').slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem', lineHeight: '1.25' }}>
                                  {c.name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 500, marginTop: '2px' }}>
                                  {code || 'NO CODE'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 500, fontSize: '0.84rem' }}>
                            {assignedRoutes.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {assignedRoutes.map((r) => (
                                  <span
                                    key={r.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #dbeafe',
                                      borderRadius: '5px',
                                      padding: '2px 8px',
                                      fontSize: '0.74rem',
                                      fontWeight: 500,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <Users size={11} color="#2563eb" /> {r.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Unassigned</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#1e293b', fontWeight: 500, fontSize: '0.84rem' }}>
                            {c.contactPerson || '—'}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem' }}>
                            <div>{c.phone || '—'}</div>
                            {c.email && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>{c.email}</div>}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.82rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.address || ''}>
                            {c.address ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} color="#64748b" style={{ flexShrink: 0 }} /> {c.address}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem', fontWeight: 500, textAlign: 'right' }}>
                            LKR {Number(c.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>


                          <td style={{ padding: '12px 12px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmStatusModal({ isOpen: true, customer: c });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: active ? '#16a34a' : '#dc2626',
                                whiteSpace: 'nowrap',
                              }}
                              title={`Status: ${active ? 'Active' : 'Inactive'} (Click to change status)`}
                            >
                              <span
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  backgroundColor: active ? '#16a34a' : '#dc2626',
                                  display: 'inline-block',
                                }}
                              />
                              {active ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {/* Print Customer Profile A4 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pdfApi.printCustomer(c.id);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                                  e.currentTarget.style.color = '#0f172a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.color = '#334155';
                                }}
                                title="Print Customer Statement (A4)"
                              >
                                <Printer size={13} />
                              </button>

                              {/* History */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewCustomerHistory(c);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                                title="View Customer History & Ledger"
                              >
                                <History size={13} />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditCustomer(c);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Edit Customer"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: Customer Groups & Routes View */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Header row with Title, subtitle and Create Group button (Fixed / Sticky to Desktop Screen) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                Customer Groups
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                Organize customers into groups and assign a dedicated staff member to manage each customer group.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateRouteView}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
            >
              <Plus size={16} /> Create Customer Group
            </button>
          </div>

          {/* Routes Toolbar: Search Input + Action Icons (White Card Look - Matching Employees Page Theme) */}
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
              flexWrap: 'wrap',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Search bar filling width */}
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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
                placeholder="Search customer groups by name, assigned staff, description..."
                value={routeSearchTerm}
                onChange={(e) => setRouteSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                }}
              />
              {routeSearchTerm && (
                <button
                  type="button"
                  onClick={() => setRouteSearchTerm('')}
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
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Group Status Filter & Icon Buttons (Export CSV, Print, Download PDF, Refresh) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <select
                value={groupStatusFilter}
                onChange={(e) => setGroupStatusFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 30px 0 12px',
                  width: '135px',
                  minWidth: '115px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.86rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
                }}
              >
                <option value="all">All Groups</option>
                <option value="active">Active Groups</option>
                <option value="inactive">Inactive Groups</option>
              </select>

              {/* Export CSV (Icon Only) */}
              <button
                type="button"
                onClick={handleExportRoutesCSV}
                style={{
                  height: '34px',
                  width: '36px',
                  minWidth: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Export customer groups to CSV"
              >
                <Download size={14} />
              </button>

              {/* Print Groups Directory A4 (Icon Only) */}
              <button
                type="button"
                onClick={handlePrintCustomerGroupsReport}
                style={{
                  height: '34px',
                  width: '36px',
                  minWidth: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Customer Groups Directory (A4)"
              >
                <Printer size={14} />
              </button>

              {/* Refresh Groups (Icon Only) */}
              <button
                type="button"
                onClick={loadInitialData}
                style={{
                  height: '34px',
                  width: '36px',
                  minWidth: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh customer groups"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Routes Cards Grid Scroll Container (Only cards scroll) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '14px',
                paddingBottom: '16px',
              }}
            >
              {filteredRoutes.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: '#64748b',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                  }}
                >
                  No customer groups found matching current search.
                </div>
              ) : (
                filteredRoutes.map((route) => {
                  const count = route.customerIds?.length || 0;
                  const assignedSalesman = salesmen.find((s) => String(s.id) === String(route.assignedStaffId || route.salesmanId));
                  const repName = route.assignedStaffName || route.salesmanName || assignedSalesman?.name;
                  const isGroupActive = route.isActive !== false;

                  return (
                    <div
                      key={route.id}
                      onClick={() => handleOpenRouteView(route)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                        minHeight: '140px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0284c7';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                      }}
                    >
                      <div>
                        {/* Card Top: Route Name & Status / Count Badges */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '8px',
                            marginBottom: '8px',
                          }}
                        >
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>
                              {route.name}
                            </h3>
                            {(route.groupCode || route.routeCode) && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                {route.groupCode || route.routeCode}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {/* Clickable Status Badge to toggle Active / Inactive */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleRouteActive(route, e)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                backgroundColor: isGroupActive ? '#dcfce7' : '#fee2e2',
                                color: isGroupActive ? '#15803d' : '#b91c1c',
                                border: `1px solid ${isGroupActive ? '#86efac' : '#fca5a5'}`,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isGroupActive ? '#bbf7d0' : '#fecaca';
                                e.currentTarget.style.transform = 'scale(1.03)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isGroupActive ? '#dcfce7' : '#fee2e2';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title={`Status: ${isGroupActive ? 'Active' : 'Inactive'} (Click to set as ${isGroupActive ? 'Inactive' : 'Active'})`}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: isGroupActive ? '#16a34a' : '#dc2626',
                                  display: 'inline-block',
                                }}
                              />
                              {isGroupActive ? 'Active' : 'Inactive'}
                            </button>

                            {/* Customer Count */}
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#f0f9ff',
                                color: '#0284c7',
                                border: '1px solid #bae6fd',
                                borderRadius: '9999px',
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                              }}
                            >
                              <Users size={11} />
                              {count}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                          {route.description || 'No description added'}
                        </p>

                        {/* Responsible Staff */}
                        <p
                          style={{
                            color: repName ? '#0369a1' : '#64748b',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            margin: '0 0 12px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <UserCheck size={13} color={repName ? '#0284c7' : '#94a3b8'} />
                          {repName ? `Assigned Staff: ${repName}` : 'No staff member assigned'}
                        </p>
                      </div>

                      {/* Card Footer: View link & Print/Download icons */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '10px',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={13} /> View Group Details →
                        </span>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              pdfApi.printCustomerGroup(route.id);
                            }}
                            style={{
                              width: '30px',
                              height: '30px',
                              minWidth: '30px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#334155';
                            }}
                            title="Print Customer Group (A4)"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customer Group & Route View Popup (Split 2 Columns)   */}
      {/* ------------------------------------------------------------- */}
      {(selectedRoute || isCreatingRoute) && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1040px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              height: 'min(640px, 86vh)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ------------------------------------------------------------- */}
            {/* VIEW MODE: Read-Only Group View with "Update Group" button    */}
            {/* ------------------------------------------------------------- */}
            {routeModalMode === 'view' && !isCreatingRoute ? (
              <>
                {/* View Mode Header */}
                <div
                  style={{
                    padding: '14px 22px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                      {selectedRoute?.name}
                    </h3>
                    {(selectedRoute?.groupCode || selectedRoute?.routeCode) && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {selectedRoute?.groupCode || selectedRoute?.routeCode}
                      </span>
                    )}

                    {/* Clickable Status Badge in View Popup Header */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleRouteActive(selectedRoute, e)}
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 11px',
                        borderRadius: '9999px',
                        backgroundColor: selectedRoute?.isActive !== false ? '#dcfce7' : '#fee2e2',
                        color: selectedRoute?.isActive !== false ? '#15803d' : '#b91c1c',
                        border: `1px solid ${selectedRoute?.isActive !== false ? '#86efac' : '#fca5a5'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = selectedRoute?.isActive !== false ? '#bbf7d0' : '#fecaca';
                        e.currentTarget.style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = selectedRoute?.isActive !== false ? '#dcfce7' : '#fee2e2';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title={`Status: ${selectedRoute?.isActive !== false ? 'Active' : 'Inactive'} (Click to set as ${selectedRoute?.isActive !== false ? 'Inactive' : 'Active'})`}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: selectedRoute?.isActive !== false ? '#16a34a' : '#dc2626',
                          display: 'inline-block',
                        }}
                      />
                      {selectedRoute?.isActive !== false ? 'Active' : 'Inactive'}
                    </button>

                    {/* Count */}
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        backgroundColor: '#f0f9ff',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                      }}
                    >
                      {assignedCustomerList.length} Assigned Customer{assignedCustomerList.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Print Customer Group A4 */}
                    <button
                      type="button"
                      onClick={() => pdfApi.printCustomerGroup(selectedRoute?.id)}
                      style={{
                        width: '34px',
                        height: '34px',
                        minWidth: '34px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        color: '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#94a3b8';
                        e.currentTarget.style.color = '#0f172a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.color = '#334155';
                      }}
                      title="Print Customer Group (A4)"
                    >
                      <Printer size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseRouteView}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* View Mode Body */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 340px) 1fr',
                    gap: '20px',
                    padding: '18px 22px',
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {/* Left Column: Read-Only Info Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '14px' }}>
                        Customer Group Details
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Group Name
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                          {selectedRoute?.name}
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Group Code
                        </div>
                        <div style={{ fontSize: '0.86rem', color: '#334155', fontFamily: 'monospace', marginTop: '2px' }}>
                          {selectedRoute?.groupCode || selectedRoute?.routeCode || 'Auto-generated'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Status
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleRouteActive(selectedRoute, e)}
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              backgroundColor: selectedRoute?.isActive !== false ? '#dcfce7' : '#fee2e2',
                              color: selectedRoute?.isActive !== false ? '#15803d' : '#b91c1c',
                              border: `1px solid ${selectedRoute?.isActive !== false ? '#86efac' : '#fca5a5'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title={`Status: ${selectedRoute?.isActive !== false ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: selectedRoute?.isActive !== false ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {selectedRoute?.isActive !== false ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Assigned Staff Member
                        </div>
                        <div style={{ fontSize: '0.86rem', color: '#0369a1', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={13} />
                          {selectedRoute?.assignedStaffName || selectedRoute?.salesmanName || 'No staff assigned'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Description / Notes
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '3px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {selectedRoute?.description || 'No description added.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Assigned Customers List */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      minHeight: 0,
                      height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                        Assigned Customers ({assignedCustomerList.length})
                      </span>
                    </div>

                    {/* Search in Assigned Customers */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search
                        size={13}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '10px',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search assigned customers..."
                        value={customerSearchInRoute}
                        onChange={(e) => setCustomerSearchInRoute(e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 28px 0 30px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.82rem',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      />
                      {customerSearchInRoute && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchInRoute('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Table of Assigned Customers */}
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc' }}>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Contact / Phone</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedCustomerList.length === 0 ? (
                              <tr>
                                <td colSpan="3" style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <Users size={28} color="#cbd5e1" />
                                    <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.86rem' }}>
                                      {customerSearchInRoute ? 'No matching assigned customers found' : 'No customers assigned yet'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                      {customerSearchInRoute
                                        ? 'Try adjusting your search query.'
                                        : 'Click the "Update Group" button below to add customers to this group.'}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              assignedCustomerList.map((c) => (
                                <tr
                                  key={c.id}
                                  style={{ borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div
                                        style={{
                                          width: '26px',
                                          height: '26px',
                                          borderRadius: '50%',
                                          backgroundColor: '#e0f2fe',
                                          color: '#0284c7',
                                          border: '1px solid #bae6fd',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 600,
                                          fontSize: '0.74rem',
                                        }}
                                      >
                                        {(c.name || 'C').slice(0, 1).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                          {c.code || c.customerCode}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#334155' }}>
                                    <div>{c.contactPerson || '—'}</div>
                                    {c.phone && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.phone}</div>}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        padding: '2px 7px',
                                        borderRadius: '9999px',
                                        backgroundColor: isCustomerActive(c) ? '#dcfce7' : '#fee2e2',
                                        color: isCustomerActive(c) ? '#15803d' : '#b91c1c',
                                      }}
                                    >
                                      {isCustomerActive(c) ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Mode Footer */}
                <div
                  style={{
                    padding: '12px 22px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseRouteView}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>

                  {/* Update Group Action in Footer */}
                  {canEditCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        const staffId = routeEditForm.salesmanId || selectedRoute?.assignedStaffId || selectedRoute?.salesmanId || '';
                        const st = salesmen.find((s) => String(s.id) === String(staffId));
                        setStaffSearchQuery(st ? st.name : '');
                        setIsStaffSearchOpen(false);
                        setInlineCustomerSearch('');
                        setIsInlineCustomerSearchOpen(false);
                        setRouteModalMode('edit');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                    >
                      <Edit2 size={14} /> Update Customer Group
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* ------------------------------------------------------------- */
              /* EDIT MODE: Editable Form & Customer Assignment                */
              /* ------------------------------------------------------------- */
              <>
                {/* Edit Mode Header */}
                <div
                  style={{
                    padding: '14px 22px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                      {isCreatingRoute ? 'Create Customer Group' : `Update Customer Group: ${routeEditForm.name || selectedRoute?.name}`}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f0f9ff',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                      }}
                    >
                      {routeEditForm.selectedCustomerIds.length} Assigned
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedRoute && (
                      <button
                        type="button"
                        onClick={() => setRouteModalMode('view')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <ArrowLeft size={13} /> Back to View
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseRouteView}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Edit Mode Body */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 340px) 1fr',
                    gap: '20px',
                    padding: '18px 22px',
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {/* Left Column: Form Fields */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '14px' }}>
                        Customer Group Details
                      </div>

                      {/* Route Name Input */}
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Customer Group Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Wholesale Tier A, Corporate Accounts"
                          value={routeEditForm.name}
                          onChange={(e) => setRouteEditForm({ ...routeEditForm, name: e.target.value })}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.88rem',
                            backgroundColor: '#ffffff',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Responsible Staff Search Box with Autocomplete Dropdown */}
                      <div ref={staffSearchRef} style={{ marginBottom: '14px', position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Assigned Staff Member
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Search
                            size={14}
                            style={{
                              position: 'absolute',
                              left: '10px',
                              top: '10px',
                              color: '#94a3b8',
                              pointerEvents: 'none',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Search staff by name, code, role..."
                            value={
                              isStaffSearchOpen
                                ? staffSearchQuery
                                : (currentAssignedStaff ? `${currentAssignedStaff.name} (${currentAssignedStaff.role || currentAssignedStaff.salesmanCode})` : '')
                            }
                            onChange={(e) => {
                              setStaffSearchQuery(e.target.value);
                              setIsStaffSearchOpen(true);
                            }}
                            onFocus={() => {
                              setStaffSearchQuery(currentAssignedStaff?.name || '');
                              setIsStaffSearchOpen(true);
                            }}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 30px 0 32px',
                              borderRadius: '6px',
                              border: isStaffSearchOpen ? '1px solid #0284c7' : '1px solid #e2e8f0',
                              fontSize: '0.86rem',
                              backgroundColor: '#ffffff',
                              boxSizing: 'border-box',
                              outline: 'none',
                              boxShadow: isStaffSearchOpen ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          />
                          {(routeEditForm.salesmanId || staffSearchQuery) && (
                            <button
                              type="button"
                              onClick={() => {
                                setRouteEditForm((prev) => ({ ...prev, salesmanId: '' }));
                                setStaffSearchQuery('');
                                setIsStaffSearchOpen(false);
                              }}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                padding: 0,
                              }}
                              title="Clear assigned staff"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Autocomplete Dropdown List */}
                        {isStaffSearchOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              right: 0,
                              maxHeight: '220px',
                              overflowY: 'auto',
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.06)',
                              zIndex: 100,
                            }}
                          >
                            <div
                              onClick={() => {
                                setRouteEditForm((prev) => ({ ...prev, salesmanId: '' }));
                                setStaffSearchQuery('');
                                setIsStaffSearchOpen(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                fontSize: '0.82rem',
                                color: '#64748b',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f1f5f9',
                                fontStyle: 'italic',
                                backgroundColor: !routeEditForm.salesmanId ? '#f0f9ff' : '#ffffff',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = !routeEditForm.salesmanId ? '#f0f9ff' : '#ffffff')}
                            >
                              — None (Unassigned) —
                            </div>

                            {filteredStaffList.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                No staff members found matching "{staffSearchQuery}"
                              </div>
                            ) : (
                              filteredStaffList.map((s) => {
                                const isSelected = String(routeEditForm.salesmanId) === String(s.id);
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      setRouteEditForm((prev) => ({ ...prev, salesmanId: String(s.id) }));
                                      setStaffSearchQuery(s.name);
                                      setIsStaffSearchOpen(false);
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                      cursor: 'pointer',
                                      backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                                      borderBottom: '1px solid #f1f5f9',
                                      transition: 'background-color 0.1s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#ffffff';
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>
                                        {s.name}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <span style={{ fontFamily: 'monospace' }}>{s.salesmanCode}</span>
                                        {s.phone && <span>• {s.phone}</span>}
                                      </div>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: '#e0f2fe',
                                        color: '#0284c7',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {s.role || 'Staff'}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Description Input */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Group Description / Notes
                        </label>
                        <textarea
                          rows="3"
                          placeholder="e.g. Group of wholesale and corporate client accounts"
                          value={routeEditForm.description}
                          onChange={(e) => setRouteEditForm({ ...routeEditForm, description: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.86rem',
                            backgroundColor: '#ffffff',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Customer Management with Assign and Remove */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      minHeight: 0,
                      height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          Customer Members:
                        </span>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            backgroundColor: '#f0f9ff',
                            color: '#0284c7',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          {routeEditForm.selectedCustomerIds.length} Assigned
                        </span>
                      </div>
                    </div>

                    {/* Inline Customer Search & Add Box with Dropdown */}
                    <div ref={inlineCustomerSearchRef} style={{ position: 'relative', width: '100%' }}>
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '10px',
                          color: '#0284c7',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search customer by name, code, phone to add to group..."
                        value={inlineCustomerSearch}
                        onChange={(e) => {
                          setInlineCustomerSearch(e.target.value);
                          setIsInlineCustomerSearchOpen(true);
                        }}
                        onFocus={() => setIsInlineCustomerSearchOpen(true)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 30px 0 32px',
                          borderRadius: '6px',
                          border: isInlineCustomerSearchOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          fontSize: '0.84rem',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box',
                          outline: 'none',
                          boxShadow: isInlineCustomerSearchOpen ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      />
                      {inlineCustomerSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineCustomerSearch('');
                            setIsInlineCustomerSearchOpen(false);
                          }}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 0,
                          }}
                          title="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}

                      {/* Dropdown with matching customers to add */}
                      {isInlineCustomerSearchOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            maxHeight: '260px',
                            overflowY: 'auto',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 8px -2px rgba(15, 23, 42, 0.08)',
                            zIndex: 100,
                          }}
                        >
                          {inlineCustomerSearchResults.length === 0 ? (
                            <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                              {inlineCustomerSearch ? `No active customers found matching "${inlineCustomerSearch}"` : 'Type customer name, code, phone or address to search'}
                            </div>
                          ) : (
                            inlineCustomerSearchResults.map((c) => {
                              const isAlreadyAssigned = (routeEditForm.selectedCustomerIds || []).some(
                                (id) => String(id) === String(c.id)
                              );
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    if (isAlreadyAssigned) return;
                                    setRouteEditForm((prev) => ({
                                      ...prev,
                                      selectedCustomerIds: [...prev.selectedCustomerIds, String(c.id)],
                                    }));
                                    addToast(`Added "${c.name}" to group`, 'success');
                                    setInlineCustomerSearch('');
                                    setIsInlineCustomerSearchOpen(false);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    cursor: isAlreadyAssigned ? 'default' : 'pointer',
                                    backgroundColor: isAlreadyAssigned ? '#f8fafc' : '#ffffff',
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background-color 0.1s ease',
                                    opacity: isAlreadyAssigned ? 0.7 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isAlreadyAssigned) e.currentTarget.style.backgroundColor = '#f0f9ff';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isAlreadyAssigned) e.currentTarget.style.backgroundColor = isAlreadyAssigned ? '#f8fafc' : '#ffffff';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                    <div
                                      style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        backgroundColor: '#e0f2fe',
                                        color: '#0284c7',
                                        border: '1px solid #bae6fd',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 600,
                                        fontSize: '0.74rem',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {(c.name || 'C').slice(0, 1).toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.name}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                                          {c.code || c.customerCode || 'NO CODE'}
                                        </span>
                                        {c.phone && <span>📞 {c.phone}</span>}
                                        {c.address && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>📍 {c.address}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ flexShrink: 0 }}>
                                    {isAlreadyAssigned ? (
                                      <span
                                        style={{
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          color: '#15803d',
                                          backgroundColor: '#dcfce7',
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          border: '1px solid #bbf7d0',
                                        }}
                                      >
                                        ✓ Assigned
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          color: '#0284c7',
                                          backgroundColor: '#e0f2fe',
                                          padding: '3px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid #bae6fd',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                        }}
                                      >
                                        <Plus size={12} /> Add
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Filter already assigned table */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search
                        size={13}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '10px',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Filter assigned members below..."
                        value={customerSearchInRoute}
                        onChange={(e) => setCustomerSearchInRoute(e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          padding: '0 28px 0 30px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.8rem',
                          backgroundColor: '#f8fafc',
                          boxSizing: 'border-box',
                        }}
                      />
                      {customerSearchInRoute && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchInRoute('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '7px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Assigned Customers Table with Remove button */}
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc' }}>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Contact / Phone</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedCustomerList.length === 0 ? (
                              <tr>
                                <td colSpan="4" style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <Users size={28} color="#cbd5e1" />
                                    <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.86rem' }}>
                                      {customerSearchInRoute ? 'No matching assigned customers found' : 'No customers assigned yet'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                      {customerSearchInRoute
                                        ? 'Try adjusting your search query above.'
                                        : 'Click the "Assign Customer" button above to search and assign customers.'}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              assignedCustomerList.map((c) => (
                                <tr
                                  key={c.id}
                                  style={{ borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div
                                        style={{
                                          width: '26px',
                                          height: '26px',
                                          borderRadius: '50%',
                                          backgroundColor: '#e0f2fe',
                                          color: '#0284c7',
                                          border: '1px solid #bae6fd',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 600,
                                          fontSize: '0.74rem',
                                        }}
                                      >
                                        {(c.name || 'C').slice(0, 1).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                          {c.code || c.customerCode}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#334155' }}>
                                    <div>{c.contactPerson || '—'}</div>
                                    {c.phone && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.phone}</div>}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        padding: '2px 7px',
                                        borderRadius: '9999px',
                                        backgroundColor: isCustomerActive(c) ? '#dcfce7' : '#fee2e2',
                                        color: isCustomerActive(c) ? '#15803d' : '#b91c1c',
                                      }}
                                    >
                                      {isCustomerActive(c) ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRouteEditForm({
                                          ...routeEditForm,
                                          selectedCustomerIds: routeEditForm.selectedCustomerIds.filter((id) => id !== String(c.id)),
                                        });
                                      }}
                                      style={{
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                      }}
                                      title="Remove customer from group"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Mode Footer */}
                <div
                  style={{
                    padding: '12px 22px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRoute) {
                        setRouteModalMode('view');
                      } else {
                        handleCloseRouteView();
                      }
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRouteView}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                  >
                    <Check size={16} /> {isCreatingRoute ? 'Save New Customer Group' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* ------------------------------------------------------------- */}
      {/* TAB: Customer Range & Targets                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'targets' && (
        <CustomerTargetsTab
          customers={customers}
          salesmen={salesmen}
          routes={routes}
          canEdit={canEditCustomer}
          addToast={addToast}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Customer History (Dedicated Multi-Table & Search)      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingBottom: '24px',
          }}
        >
          {loading ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '60px 24px',
                textAlign: 'center',
              }}
            >
              <Users size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto', display: 'block' }} />
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
                Loading customer records...
              </p>
            </div>
          ) : customers.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '60px 24px',
                textAlign: 'center',
              }}
            >
              <Users size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                No Customers in System
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
                Create customer accounts first to access their financial history and transactions.
              </p>
              <button
                type="button"
                onClick={handleOpenAddCustomer}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add Customer
              </button>
            </div>
          ) : (
            <>
              {/* TOP CUSTOMER HISTORY HEADER (2 EQUAL HALVES: Left = Search + Customer Details, Right = 3-KPI Card) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: '12px',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  flexWrap: 'wrap',
                }}
              >
                {/* LEFT HALF (50% of window): Search bar on top, Customer Details on bottom (both same width) */}
                <div
                  style={{
                    flex: selectedHistoryCustomer ? '1 1 360px' : 1,
                    width: selectedHistoryCustomer ? 'calc(50% - 6px)' : '100%',
                    minWidth: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Search Bar with Autocomplete Suggestions Dropdown */}
                  <div
                    ref={searchContainerRef}
                    style={{
                      position: 'relative',
                      width: '100%',
                    }}
                  >
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '10px',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search customer by code, name, phone, or route to view history..."
                      value={customerSearchInput}
                      onChange={(e) => {
                        setCustomerSearchInput(e.target.value);
                        setIsCustomerSearchOpen(true);
                      }}
                      onFocus={() => setIsCustomerSearchOpen(true)}
                      style={{
                        width: '100%',
                        height: '35px',
                        padding: '0 32px 0 36px',
                        borderRadius: '6px',
                        border: isCustomerSearchOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        fontSize: '0.86rem',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                        boxShadow: isCustomerSearchOpen ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                    />
                    {customerSearchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHistoryCustomerId('');
                          setCustomerSearchInput('');
                          setIsCustomerSearchOpen(true);
                        }}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '9px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          padding: '2px',
                        }}
                        title="Clear customer selection"
                      >
                        <X size={14} />
                      </button>
                    )}

                    {/* Floating Autocomplete Suggestions Dropdown */}
                    {isCustomerSearchOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          maxHeight: '280px',
                          overflowY: 'auto',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.06)',
                          zIndex: 100,
                        }}
                      >
                        {filteredHistoryCustomerOptions.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No matching customers found for "{customerSearchInput}"
                          </div>
                        ) : (
                          filteredHistoryCustomerOptions.map((c) => {
                            const isSelected = selectedHistoryCustomerId === String(c.id);
                            const route = getCustomerRoute(c.id);
                            return (
                              <div
                                key={c.id}
                                onClick={() => handleSelectCustomerForHistory(c)}
                                style={{
                                  padding: '9px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.1s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                                    {c.name}
                                  </span>
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      backgroundColor: '#f1f5f9',
                                      color: '#475569',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #e2e8f0',
                                    }}
                                  >
                                    {c.code || c.customerCode || 'NO CODE'}
                                  </span>
                                  {c.phone && (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                      📞 {c.phone}
                                    </span>
                                  )}
                                  {route?.name && (
                                    <span
                                      style={{
                                        fontSize: '0.74rem',
                                        color: '#0284c7',
                                        backgroundColor: '#e0f2fe',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      👥 {route.name}
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      borderRadius: '9999px',
                                      backgroundColor: isCustomerActive(c) ? '#dcfce7' : '#fee2e2',
                                      color: isCustomerActive(c) ? '#15803d' : '#b91c1c',
                                    }}
                                  >
                                    {isCustomerActive(c) ? 'Active' : 'Inactive'}
                                  </span>
                                  {isSelected && <Check size={13} color="#0284c7" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer Details Line (Same width as Search Bar = half the window) */}
                  {selectedHistoryCustomer && (
                    <div
                      style={{
                        width: '100%',
                        height: '35px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '0 12px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.84rem',
                        boxSizing: 'border-box',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#1e293b',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {selectedHistoryCustomer.code || selectedHistoryCustomer.customerCode || 'NO CODE'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            backgroundColor: isCustomerActive(selectedHistoryCustomer) ? '#dcfce7' : '#fee2e2',
                            color: isCustomerActive(selectedHistoryCustomer) ? '#15803d' : '#b91c1c',
                            border: isCustomerActive(selectedHistoryCustomer) ? '1px solid #bbf7d0' : '1px solid #fecaca',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {isCustomerActive(selectedHistoryCustomer) ? 'Active' : 'Inactive'}
                        </span>
                        <span
                          style={{
                            color: '#475569',
                            fontSize: '0.78rem',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title={selectedHistoryCustomer.address || 'No address registered'}
                        >
                          <MapPin size={12} color="#64748b" style={{ flexShrink: 0 }} />
                          {selectedHistoryCustomer.address || 'No address'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {selectedHistoryCustomer.phone && (
                          <span style={{ color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            📞 {selectedHistoryCustomer.phone}
                          </span>
                        )}
                        {getCustomerRoute(selectedHistoryCustomer.id)?.name && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#0284c7',
                              backgroundColor: '#e0f2fe',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            👥 {getCustomerRoute(selectedHistoryCustomer.id)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT HALF (50% of window): Card with 3 equal columns matching left side height */}
                {selectedHistoryCustomer && (
                  <div
                    style={{
                      flex: '1 1 360px',
                      width: 'calc(50% - 6px)',
                      minWidth: '300px',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      padding: '8px 12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Column 1: Total Invoiced (equal 1/3 of the right half) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: '0 8px',
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                        Total Invoiced
                      </span>
                      <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {customerHistoryMetrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Column 2: Outstanding (equal 1/3 of the right half) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: '0 8px',
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                        Outstanding
                      </span>
                      <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
                        LKR {customerHistoryMetrics.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Column 3: Credit Limit (equal 1/3 of the right half) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: '0 8px',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                        Credit Limit
                      </span>
                      <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                        LKR {Number(selectedHistoryCustomer.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* IF NO CUSTOMER SELECTED YET: SHOW SEARCH PROMPT */}
              {!selectedHistoryCustomer ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    padding: '48px 24px',
                    textAlign: 'center',
                    marginTop: '4px',
                  }}
                >
                  <Search size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
                    Select a Customer to View History
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Type a customer name, code, phone, or route in the search bar above and click to view their transactions, invoices, and financial statement.
                  </p>
                </div>
              ) : (
                <>
                  {/* UNIFIED SUB-NAV TABS & TABLE TOOLBAR (All in one line, responsive) */}
                  {(() => {
                    const currentSearchVal =
                      historyTableTab === 'invoices' ? invoiceSearchQuery :
                      historyTableTab === 'advances' ? advanceSearchQuery :
                      historyTableTab === 'payments' ? paymentSearchQuery :
                      historyTableTab === 'cheques' ? chequeSearchQuery :
                      outstandingSearchQuery;

                    const currentSearchSetter =
                      historyTableTab === 'invoices' ? setInvoiceSearchQuery :
                      historyTableTab === 'advances' ? setAdvanceSearchQuery :
                      historyTableTab === 'payments' ? setPaymentSearchQuery :
                      historyTableTab === 'cheques' ? setChequeSearchQuery :
                      setOutstandingSearchQuery;

                    const currentSearchPlaceholder =
                      historyTableTab === 'invoices' ? 'Search invoice #...' :
                      historyTableTab === 'advances' ? 'Search voucher #...' :
                      historyTableTab === 'payments' ? 'Search receipt # or invoice #...' :
                      historyTableTab === 'cheques' ? 'Search cheque #, bank...' :
                      'Search outstanding invoice #...';

                    const currentStatusVal =
                      historyTableTab === 'invoices' ? invoiceStatusFilter :
                      historyTableTab === 'advances' ? advanceStatusFilter :
                      historyTableTab === 'payments' ? paymentStatusFilter :
                      historyTableTab === 'cheques' ? chequeStatusFilter :
                      outstandingStatusFilter;

                    const currentStatusSetter =
                      historyTableTab === 'invoices' ? setInvoiceStatusFilter :
                      historyTableTab === 'advances' ? setAdvanceStatusFilter :
                      historyTableTab === 'payments' ? setPaymentStatusFilter :
                      historyTableTab === 'cheques' ? setChequeStatusFilter :
                      setOutstandingStatusFilter;

                    const currentStatusOptions =
                      historyTableTab === 'invoices' ? [
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'PAID', label: 'Paid' },
                        { value: 'PARTIAL', label: 'Partial' },
                        { value: 'UNPAID', label: 'Unpaid' },
                      ] :
                      historyTableTab === 'advances' ? [
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'UTILIZED', label: 'Utilized' },
                      ] :
                      historyTableTab === 'payments' ? [
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'CLEARED', label: 'Cleared' },
                        { value: 'RECEIVED', label: 'Received' },
                      ] :
                      historyTableTab === 'cheques' ? [
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'CLEARED', label: 'Cleared' },
                        { value: 'PENDING', label: 'Pending' },
                        { value: 'DEPOSITED', label: 'Deposited' },
                        { value: 'BOUNCED', label: 'Bounced' },
                      ] : [
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'PARTIAL', label: 'Partial' },
                        { value: 'UNPAID', label: 'Unpaid' },
                      ];

                    const hasActiveFilter = Boolean(currentSearchVal || currentStatusVal !== 'ALL');

                    return (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          width: '100%',
                          boxSizing: 'border-box',
                          flexWrap: 'nowrap',
                          flexShrink: 0,
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                          overflowX: 'auto',
                        }}
                      >
                        {/* Sub-nav tabs */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                            padding: '2px',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '6px',
                          }}
                        >
                          {[
                            { id: 'invoices', label: 'Invoices', count: rawCustomerInvoices.length },
                            { id: 'advances', label: 'Advance Payments', count: rawCustomerAdvances.length },
                            { id: 'payments', label: 'Payments', count: rawCustomerPayments.length },
                            { id: 'cheques', label: 'Cheques', count: rawCustomerCheques.length },
                            { id: 'outstanding', label: 'Outstanding', count: rawCustomerOutstanding.length },
                          ].map((tab) => {
                            const isSel = historyTableTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setHistoryTableTab(tab.id)}
                                style={{
                                  backgroundColor: isSel ? '#ffffff' : 'transparent',
                                  border: 'none',
                                  borderRadius: '5px',
                                  padding: '4px 8px',
                                  fontSize: '0.8rem',
                                  fontWeight: isSel ? 600 : 500,
                                  color: isSel ? '#0284c7' : '#64748b',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: isSel ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>{tab.label}</span>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    padding: '1px 5px',
                                    borderRadius: '9999px',
                                    backgroundColor: isSel ? '#e0f2fe' : '#e2e8f0',
                                    color: isSel ? '#0284c7' : '#64748b',
                                  }}
                                >
                                  {tab.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Search, Filter, Reset, Export (Single-line right-aligned) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexShrink: 0,
                            marginLeft: 'auto',
                          }}
                        >
                          {/* Search Input (Generous width) */}
                          <div style={{ position: 'relative', width: '210px', minWidth: '160px' }}>
                            <Search
                              size={13}
                              style={{
                                position: 'absolute',
                                left: '8px',
                                top: '9px',
                                color: '#94a3b8',
                                pointerEvents: 'none',
                              }}
                            />
                            <input
                              type="text"
                              placeholder={currentSearchPlaceholder}
                              value={currentSearchVal}
                              onChange={(e) => currentSearchSetter(e.target.value)}
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0 24px 0 26px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.8rem',
                                outline: 'none',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.15s ease',
                              }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                              onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                            />
                            {currentSearchVal && (
                              <button
                                type="button"
                                onClick={() => currentSearchSetter('')}
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  top: '8px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#94a3b8',
                                  padding: 0,
                                }}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>

                          {/* Filter Select */}
                          <select
                            value={currentStatusVal}
                            onChange={(e) => currentStatusSetter(e.target.value)}
                            style={{
                              height: '32px',
                              padding: '0 24px 0 8px',
                              width: '105px',
                              minWidth: '95px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.8rem',
                              fontFamily: 'inherit',
                              fontWeight: 500,
                              color: '#334155',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                              outline: 'none',
                              boxSizing: 'border-box',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                              transition: 'border-color 0.15s ease',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                          >
                            {currentStatusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          {/* Reset Button */}
                          {hasActiveFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                currentSearchSetter('');
                                currentStatusSetter('ALL');
                              }}
                              style={{
                                height: '32px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Reset filter and search"
                            >
                              <X size={12} /> Reset
                            </button>
                          )}

                          {/* CSV Export Button (Icon Only) */}
                          <button
                            type="button"
                            onClick={() => handleExportTableCSV(historyTableTab)}
                            style={{
                              height: '32px',
                              width: '32px',
                              minWidth: '32px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: 0,
                              color: '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#334155';
                            }}
                            title={`Export ${historyTableTab} to CSV`}
                          >
                            <Download size={13} />
                          </button>

                          {/* Print Customer Ledger / History A4 (Icon Only) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedHistoryCustomer?.id) {
                                pdfApi.printCustomerHistory(selectedHistoryCustomer.id);
                              } else {
                                addToast('Please select a customer first', 'warning');
                              }
                            }}
                            style={{
                              height: '32px',
                              width: '32px',
                              minWidth: '32px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: 0,
                              color: '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#334155';
                            }}
                            title="Print Customer Ledger History (A4)"
                          >
                            <Printer size={13} />
                          </button>

                          {/* Refresh Customer History (Icon Only) */}
                          <button
                            type="button"
                            onClick={loadInitialData}
                            style={{
                              height: '32px',
                              width: '32px',
                              minWidth: '32px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: 0,
                              color: '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#334155';
                            }}
                            title="Refresh Customer Records"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 1: INVOICES TABLE (Matches User Screenshot!) */}
                  {historyTableTab === 'invoices' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                      {/* Invoices Table */}
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          width: '100%',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          minHeight: 0,
                        }}
                      >
                        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
                          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>INVOICE #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>DATE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>PAYMENT TYPE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>TOTAL AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>PAID AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>BALANCE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>TAGS</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCustomerInvoices.length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                    <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                    No invoices found for {selectedHistoryCustomer?.name || 'this customer'}.
                                  </td>
                                </tr>
                              ) : (
                                filteredCustomerInvoices.map((inv) => {
                                  const bal = Number(inv.balanceAmount || 0);
                                  const isPaid = (inv.status || '').toUpperCase() === 'PAID' || bal === 0;
                                  const isPartial = (inv.status || '').toUpperCase() === 'PARTIAL' || (bal > 0 && Number(inv.paidAmount || 0) > 0);
                                  return (
                                    <tr
                                      key={inv.id || inv.invoiceNumber}
                                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', cursor: 'pointer' }} onClick={() => setPreviewModalDoc({ docType: 'Invoice', data: inv })}>
                                        {inv.invoiceNumber || inv.id}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                        {inv.displayDate || inv.invoiceDate}
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '3px 9px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', textTransform: 'lowercase' }}>
                                          {inv.paymentType || 'standard'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                                        LKR {Number(inv.totalAmount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>
                                        LKR {Number(inv.paidAmount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: bal > 0 ? '#0f172a' : '#64748b' }}>
                                        LKR {bal.toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <span
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            backgroundColor: isPaid ? '#dcfce7' : isPartial ? '#e0f2fe' : '#fee2e2',
                                            color: isPaid ? '#15803d' : isPartial ? '#0284c7' : '#b91c1c',
                                            border: isPaid ? '1px solid #bbf7d0' : isPartial ? '1px solid #bae6fd' : '1px solid #fecaca',
                                            textTransform: 'lowercase',
                                          }}
                                        >
                                          {isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewModalDoc({ docType: 'Invoice', data: inv })}
                                          style={{
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '5px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                          title="View invoice details"
                                        >
                                          <Eye size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ADVANCE PAYMENTS TABLE */}
                  {historyTableTab === 'advances' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100%', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
                          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>VOUCHER #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>DATE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>PAYMENT METHOD</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>DEPOSIT AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>AVAILABLE BALANCE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>STATUS</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCustomerAdvances.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                    <DollarSign size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                    No advance payments recorded for {selectedHistoryCustomer?.name || 'this customer'}.
                                  </td>
                                </tr>
                              ) : (
                                filteredCustomerAdvances.map((adv) => {
                                  const isActive = (adv.status || '').toUpperCase() === 'ACTIVE';
                                  return (
                                    <tr
                                      key={adv.id || adv.voucherNo}
                                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', cursor: 'pointer' }} onClick={() => setPreviewModalDoc({ docType: 'Advance Payment', data: adv })}>
                                        {adv.voucherNo || adv.id}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                        {adv.displayDate || adv.date}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.85rem' }}>
                                        {adv.paymentMethod || 'Bank Transfer'}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                                        LKR {Number(adv.amount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: Number(adv.balance || 0) > 0 ? '#16a34a' : '#64748b' }}>
                                        LKR {Number(adv.balance || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <span
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            backgroundColor: isActive ? '#dcfce7' : '#f1f5f9',
                                            color: isActive ? '#15803d' : '#64748b',
                                            border: isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                            textTransform: 'lowercase',
                                          }}
                                        >
                                          {adv.status ? adv.status.toLowerCase() : 'active'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewModalDoc({ docType: 'Advance Payment', data: adv })}
                                          style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="View advance voucher details"
                                        >
                                          <Eye size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PAYMENTS TABLE */}
                  {historyTableTab === 'payments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100%', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
                          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>RECEIPT #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>DATE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>INVOICE #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>PAYMENT METHOD</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>AMOUNT PAID</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>STATUS</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCustomerPayments.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                    <CreditCard size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                    No payments recorded for {selectedHistoryCustomer?.name || 'this customer'}.
                                  </td>
                                </tr>
                              ) : (
                                filteredCustomerPayments.map((pmt) => (
                                  <tr
                                    key={pmt.id || pmt.receiptNo}
                                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', cursor: 'pointer' }} onClick={() => setPreviewModalDoc({ docType: 'Payment Receipt', data: pmt })}>
                                      {pmt.receiptNo || pmt.id}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                      {pmt.displayDate || pmt.paymentDate}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569', fontSize: '0.85rem' }}>
                                      {pmt.invoiceNo || '—'}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.85rem' }}>
                                      {pmt.paymentMethod || 'Cash'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a' }}>
                                      LKR {Number(pmt.amount || 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <span
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          backgroundColor: '#dcfce7',
                                          color: '#15803d',
                                          border: '1px solid #bbf7d0',
                                          textTransform: 'lowercase',
                                        }}
                                      >
                                        {pmt.status ? pmt.status.toLowerCase() : 'cleared'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewModalDoc({ docType: 'Payment Receipt', data: pmt })}
                                        style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="View receipt details"
                                      >
                                        <Eye size={14} />
                                      </button>
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

                  {/* TAB 4: CHEQUES TABLE */}
                  {historyTableTab === 'cheques' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100%', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
                          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>CHEQUE #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>CHEQUE DATE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>BANK NAME</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>INVOICE / REF #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>STATUS</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCustomerCheques.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                    <CreditCard size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                    No cheques recorded for {selectedHistoryCustomer?.name || 'this customer'}.
                                  </td>
                                </tr>
                              ) : (
                                filteredCustomerCheques.map((chq) => {
                                  const st = (chq.status || '').toUpperCase();
                                  const isCleared = st === 'CLEARED';
                                  const isPending = st === 'PENDING';
                                  const isBounced = st === 'BOUNCED';
                                  return (
                                    <tr
                                      key={chq.id || chq.chequeNo}
                                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', cursor: 'pointer' }} onClick={() => setPreviewModalDoc({ docType: 'Cheque', data: chq })}>
                                        {chq.chequeNo || chq.id}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                        {chq.displayDate || chq.chequeDate}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 500 }}>
                                        {chq.bankName || '—'}
                                      </td>
                                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569', fontSize: '0.85rem' }}>
                                        {chq.invoiceNo || '—'}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                                        LKR {Number(chq.amount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <span
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            backgroundColor: isCleared ? '#dcfce7' : isPending ? '#fef3c7' : isBounced ? '#fee2e2' : '#e0f2fe',
                                            color: isCleared ? '#15803d' : isPending ? '#b45309' : isBounced ? '#b91c1c' : '#0284c7',
                                            border: isCleared ? '1px solid #bbf7d0' : isPending ? '1px solid #fde68a' : isBounced ? '1px solid #fecaca' : '1px solid #bae6fd',
                                            textTransform: 'lowercase',
                                          }}
                                        >
                                          {chq.status ? chq.status.toLowerCase() : 'pending'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewModalDoc({ docType: 'Cheque', data: chq })}
                                          style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="View cheque details"
                                        >
                                          <Eye size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: OUTSTANDING PAYMENTS TABLE */}
                  {historyTableTab === 'outstanding' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100%', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
                          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>INVOICE #</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>DATE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#fafbfc' }}>PAYMENT TYPE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>TOTAL AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>PAID AMOUNT</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', backgroundColor: '#fafbfc' }}>OUTSTANDING BALANCE</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>STATUS</th>
                                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', backgroundColor: '#fafbfc' }}>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCustomerOutstanding.length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center', color: '#16a34a' }}>
                                    <CheckCircle size={36} color="#86efac" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                    All clear! No outstanding payments pending for {selectedHistoryCustomer?.name || 'this customer'}.
                                  </td>
                                </tr>
                              ) : (
                                filteredCustomerOutstanding.map((inv) => {
                                  const bal = Number(inv.balanceAmount || 0);
                                  return (
                                    <tr
                                      key={inv.id || inv.invoiceNumber}
                                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', cursor: 'pointer' }} onClick={() => setPreviewModalDoc({ docType: 'Outstanding Invoice', data: inv })}>
                                        {inv.invoiceNumber || inv.id}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                        {inv.displayDate || inv.invoiceDate}
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '3px 9px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', textTransform: 'lowercase' }}>
                                          {inv.paymentType || 'installment'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                                        LKR {Number(inv.totalAmount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>
                                        LKR {Number(inv.paidAmount || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                                        LKR {bal.toFixed(2)}
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <span
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            backgroundColor: Number(inv.paidAmount || 0) > 0 ? '#e0f2fe' : '#fee2e2',
                                            color: Number(inv.paidAmount || 0) > 0 ? '#0284c7' : '#b91c1c',
                                            border: Number(inv.paidAmount || 0) > 0 ? '1px solid #bae6fd' : '1px solid #fecaca',
                                            textTransform: 'lowercase',
                                          }}
                                        >
                                          {Number(inv.paidAmount || 0) > 0 ? 'partial' : 'unpaid'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewModalDoc({ docType: 'Outstanding Invoice', data: inv })}
                                          style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="View outstanding invoice details"
                                        >
                                          <Eye size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customer Profile View Popup (When clicking any row)   */}
      {/* ------------------------------------------------------------- */}
      {viewingCustomer && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '740px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Profile Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '18px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    flexShrink: 0,
                  }}
                >
                  {(viewingCustomer.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                      {viewingCustomer.name}
                    </h2>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {viewingCustomer.code || viewingCustomer.customerCode || 'NO CODE'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: isCustomerActive(viewingCustomer) ? '#dcfce7' : '#fee2e2',
                        color: isCustomerActive(viewingCustomer) ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {isCustomerActive(viewingCustomer) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                    {(() => {
                      const cRoutes = getCustomerRoutes(viewingCustomer.id);
                      if (cRoutes.length === 0) {
                        return <span>Group: <strong style={{ color: '#334155' }}>Unassigned</strong></span>;
                      }
                      return (
                        <span>
                          Customer Group: <strong style={{ color: '#334155' }}>{cRoutes.map((r) => r.name).join(', ')}</strong>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingCustomer;
                    setViewingCustomer(null);
                    handleOpenEditCustomer(c);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCustomer(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Profile Details Cards in Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '10px' }}>
                  Contact Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Contact Person</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingCustomer.contactPerson || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Phone Number</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingCustomer.phone || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Email Address</span>
                    <span style={{ color: '#334155' }}>{viewingCustomer.email || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Physical Address</span>
                    <span style={{ color: '#334155' }}>{viewingCustomer.address || '—'}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '10px' }}>
                  Financial & Credit Terms
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Credit Limit</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                      LKR {Number(viewingCustomer.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Current Balance</span>
                    <span style={{ fontWeight: 700, color: Number(viewingCustomer.currentBalance || 0) > 0 ? '#dc2626' : '#0f172a', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                      LKR {Number(viewingCustomer.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Credit Status</span>
                    <span style={{ fontWeight: 600, color: Number(viewingCustomer.currentBalance || 0) > Number(viewingCustomer.creditLimit || 0) ? '#dc2626' : '#15803d' }}>
                      {Number(viewingCustomer.currentBalance || 0) > Number(viewingCustomer.creditLimit || 0) ? 'Exceeded Limit' : 'Within Limit'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '10px' }}>
                  Customer Group & Assigned Staff
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                      Assigned Customer Group(s)
                    </span>
                    {(() => {
                      const cRoutes = getCustomerRoutes(viewingCustomer.id);
                      if (cRoutes.length === 0) {
                        return <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Unassigned</span>;
                      }
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {cRoutes.map((r) => (
                            <span
                              key={r.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #dbeafe',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 500,
                              }}
                            >
                              <Users size={11} color="#2563eb" /> {r.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Assigned Staff Member</span>
                    <span style={{ fontWeight: 500, color: '#0f172a' }}>
                      {(() => {
                        const cRoutes = getCustomerRoutes(viewingCustomer.id);
                        const reps = [...new Set(cRoutes.map((r) => r.assignedStaffName || r.salesmanName).filter(Boolean))];
                        return reps.length > 0 ? reps.join(', ') : 'None assigned';
                      })()}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Customer ID</span>
                    <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.74rem' }}>
                      {viewingCustomer.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const cust = viewingCustomer;
                  setViewingCustomer(null);
                  handleViewCustomerHistory(cust);
                }}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
                }}
              >
                <History size={13} /> View Financial History
              </button>

              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customer History Document Preview Modal                */}
      {/* ------------------------------------------------------------- */}
      {previewModalDoc && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {previewModalDoc.docType} Details
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                    Ref: {previewModalDoc.data.invoiceNumber || previewModalDoc.data.receiptNo || previewModalDoc.data.voucherNo || previewModalDoc.data.chequeNo || previewModalDoc.data.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalDoc(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <strong style={{ color: '#0f172a' }}>{selectedHistoryCustomer?.name || previewModalDoc.data.customerName || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Date:</span>
                <strong style={{ color: '#0f172a' }}>{previewModalDoc.data.displayDate || previewModalDoc.data.invoiceDate || previewModalDoc.data.paymentDate || previewModalDoc.data.chequeDate || previewModalDoc.data.date || '—'}</strong>
              </div>
              {previewModalDoc.data.paymentType && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Payment Type:</span>
                  <strong style={{ color: '#0284c7' }}>{previewModalDoc.data.paymentType}</strong>
                </div>
              )}
              {previewModalDoc.data.paymentMethod && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Payment Method:</span>
                  <strong style={{ color: '#0f172a' }}>{previewModalDoc.data.paymentMethod}</strong>
                </div>
              )}
              {previewModalDoc.data.bankName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Bank Name:</span>
                  <strong style={{ color: '#0f172a' }}>{previewModalDoc.data.bankName}</strong>
                </div>
              )}
              {previewModalDoc.data.invoiceNo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Linked Invoice Ref:</span>
                  <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{previewModalDoc.data.invoiceNo}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <strong style={{ color: '#16a34a' }}>{previewModalDoc.data.status || 'Active'}</strong>
              </div>

              {/* Amount Breakdown */}
              <div
                style={{
                  marginTop: '8px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {previewModalDoc.data.totalAmount !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Total Invoice Amount:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>LKR {Number(previewModalDoc.data.totalAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                {previewModalDoc.data.paidAmount !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Paid Amount:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>LKR {Number(previewModalDoc.data.paidAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                {previewModalDoc.data.balanceAmount !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                    <strong style={{ color: '#0f172a' }}>Balance Due:</strong>
                    <strong style={{ fontFamily: 'monospace', color: Number(previewModalDoc.data.balanceAmount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      LKR {Number(previewModalDoc.data.balanceAmount || 0).toFixed(2)}
                    </strong>
                  </div>
                )}
                {previewModalDoc.data.amount !== undefined && previewModalDoc.data.totalAmount === undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Document Amount:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>LKR {Number(previewModalDoc.data.amount || 0).toFixed(2)}</span>
                  </div>
                )}
                {previewModalDoc.data.balance !== undefined && previewModalDoc.data.balanceAmount === undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                    <strong style={{ color: '#0f172a' }}>Available Balance:</strong>
                    <strong style={{ fontFamily: 'monospace', color: '#16a34a' }}>LKR {Number(previewModalDoc.data.balance || 0).toFixed(2)}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setPreviewModalDoc(null)}
                style={{
                  padding: '7px 18px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Add / Edit Customer */}
      {/* ------------------------------------------------------------- */}
      {showCustomerModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '800px',
              padding: '28px 32px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Enter customer directory details and contact information
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Customer Code
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (e.g. CUST-001)"
                    value={customerForm.code}
                    onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Supermarket"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={customerForm.contactPerson}
                    onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 077 123 4567"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Email & Credit Limit */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. info@apex.com"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Approved Credit Limit (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={customerForm.creditLimit}
                    onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Address (Full Width) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123 Main Street, Colombo 03"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  style={{
                    backgroundColor: '#0284c7',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                >
                  {savingCustomer ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customer Status Change Confirmation Modal             */}
      {/* ------------------------------------------------------------- */}
      {confirmStatusModal.isOpen && confirmStatusModal.customer && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1200, backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
          onClick={() => setConfirmStatusModal({ isOpen: false, customer: null })}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: isCustomerActive(confirmStatusModal.customer) ? '#fee2e2' : '#dcfce7',
                  color: isCustomerActive(confirmStatusModal.customer) ? '#dc2626' : '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isCustomerActive(confirmStatusModal.customer) ? (
                  <AlertTriangle size={22} />
                ) : (
                  <CheckCircle size={22} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {isCustomerActive(confirmStatusModal.customer)
                    ? 'Deactivate Customer?'
                    : 'Activate Customer?'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                  Are you sure you want to change the status of customer{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {confirmStatusModal.customer.name}
                  </strong>{' '}
                  ({confirmStatusModal.customer.code || confirmStatusModal.customer.customerCode || `#${confirmStatusModal.customer.id}`}) to{' '}
                  <strong
                    style={{
                      color: isCustomerActive(confirmStatusModal.customer) ? '#dc2626' : '#16a34a',
                    }}
                  >
                    {isCustomerActive(confirmStatusModal.customer) ? 'Inactive' : 'Active'}
                  </strong>
                  ?
                </p>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    lineHeight: 1.4,
                  }}
                >
                  {isCustomerActive(confirmStatusModal.customer)
                    ? '⚠️ When marked Inactive, this customer will be hidden from customer lists, sales invoicing, quotations, and assignments until reactivated.'
                    : '✓ When marked Active, this customer will be visible and available across all transactions and modules.'}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '14px',
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmStatusModal({ isOpen: false, customer: null })}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cust = confirmStatusModal.customer;
                  setConfirmStatusModal({ isOpen: false, customer: null });
                  if (cust) {
                    await handleToggleCustomerActive(cust.id, isCustomerActive(cust));
                  }
                }}
                style={{
                  backgroundColor: isCustomerActive(confirmStatusModal.customer) ? '#dc2626' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isCustomerActive(confirmStatusModal.customer)
                    ? '0 2px 6px rgba(220, 38, 38, 0.25)'
                    : '0 2px 6px rgba(22, 163, 74, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isCustomerActive(confirmStatusModal.customer)
                  ? 'Yes, Deactivate'
                  : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
