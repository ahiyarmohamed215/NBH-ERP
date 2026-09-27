import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  customerApi,
  salesmanApi,
  userApi,
  salesApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Users,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
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
} from 'lucide-react';

const STORAGE_KEY_ROUTES = 'erp_customer_routes_v1';
const STORAGE_KEY_INVOICES = 'erp_commercial_invoices_v1';
const STORAGE_KEY_QUOTATIONS = 'erp_quotations_v1';
const STORAGE_KEY_ORDERS = 'erp_sales_orders_v1';
const STORAGE_KEY_PAYMENTS = 'erp_customer_payments_v1';
const STORAGE_KEY_ADVANCES = 'erp_advance_payments_v1';
const STORAGE_KEY_CHEQUES = 'erp_customer_cheques_v1';

const DEFAULT_SAMPLE_INVOICES = [];
const DEFAULT_SAMPLE_PAYMENTS = [];
const DEFAULT_SAMPLE_ADVANCES = [];
const DEFAULT_SAMPLE_CHEQUES = [];

const DEFAULT_SAMPLE_QUOTATIONS = [
  { id: 'qt-1', quotationNo: 'QT-2026-001', customerName: 'Negombo Motors', date: '2026-09-18', validUntil: '2026-10-18', totalAmount: 45000.0, status: 'ACCEPTED' },
  { id: 'qt-2', quotationNo: 'QT-2026-002', customerName: 'AIA Insurance', date: '2026-09-15', validUntil: '2026-10-15', totalAmount: 125000.0, status: 'SENT' },
];

const DEFAULT_SAMPLE_ORDERS = [
  { id: 'ord-1', orderNo: 'SO-2026-001', customerName: 'Negombo Motors', orderDate: '2026-09-19', deliveryDate: '2026-09-25', totalAmount: 45000.0, paymentStatus: 'PAID', orderStatus: 'CONFIRMED' },
  { id: 'ord-2', orderNo: 'SO-2026-002', customerName: 'AIA Insurance', orderDate: '2026-09-16', deliveryDate: '2026-09-22', totalAmount: 125000.0, paymentStatus: 'PARTIAL', orderStatus: 'PROCESSING' },
];

export default function CustomersHub({ activeSubTab = 'list', onSubTabChange }) {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(() => {
    if (activeSubTab === 'groups' || activeSubTab === 'routes') return 'groups';
    if (activeSubTab === 'history') return 'history';
    return 'list';
  });

  // Data states
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(false);

  // Customer List Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

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
    routeId: '',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);

  // Simple Deletion Confirmation Modal State
  const [securityModalData, setSecurityModalData] = useState(null);
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

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
  const [routes, setRoutes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROUTES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'route-1',
        name: 'Route 1',
        description: '',
        salesmanId: '',
        salesmanName: '',
        customerIds: [],
        createdAt: new Date().toISOString(),
      },
    ];
  });

  // Inline Route View state (replaces all popups for Groups & Routes)
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeEditForm, setRouteEditForm] = useState({
    name: '',
    description: '',
    salesmanId: '',
    selectedCustomerIds: [],
  });
  const [customerSearchInRoute, setCustomerSearchInRoute] = useState('');
  const [showAssignCustomerModal, setShowAssignCustomerModal] = useState(false);
  const [assignCustomerSearch, setAssignCustomerSearch] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');

  // Sync subTab prop
  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(
        activeSubTab === 'groups' || activeSubTab === 'routes'
          ? 'groups'
          : activeSubTab === 'history'
          ? 'history'
          : 'list'
      );
    }
  }, [activeSubTab]);

  // Persist routes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
    } catch (e) {
      console.error(e);
    }
  }, [routes]);

  // Close customer search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsCustomerSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial load of customers, salesmen, and user employees
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes, uRes] = await Promise.allSettled([
        customerApi.getAll(),
        salesmanApi.getAll(),
        userApi.getAll({ page: 0, size: 200 }),
      ]);

      let loadedCustomers = [];
      if (cRes.status === 'fulfilled') {
        loadedCustomers = cRes.value.data || cRes.value || [];
        setCustomers(loadedCustomers);
      }

      const rawSalesmen = sRes.status === 'fulfilled' ? (sRes.value.data || sRes.value || []) : [];
      const rawUsers = uRes.status === 'fulfilled' ? (uRes.value.data?.content || uRes.value.data || uRes.value || []) : [];

      // Combine sales representatives and staff members so all sales reps show up
      const combinedReps = [];
      const seen = new Set();

      rawSalesmen.forEach((s) => {
        const name = s.name || s.fullName;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          combinedReps.push({
            id: String(s.id),
            name: name,
            salesmanCode: s.salesmanCode || s.code || 'REP',
            phone: s.phone || '',
          });
        }
      });

      rawUsers.forEach((u) => {
        const name = u.fullName || u.username;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          combinedReps.push({
            id: String(u.id),
            name: name,
            salesmanCode: u.username || 'EMP',
            phone: u.phone || '',
          });
        }
      });

      setSalesmen(combinedReps);

      // If default Route 1 has no customers yet and we have customers, assign first 3
      setRoutes((prevRoutes) => {
        if (
          prevRoutes.length === 1 &&
          prevRoutes[0].name === 'Route 1' &&
          prevRoutes[0].customerIds.length === 0 &&
          loadedCustomers.length > 0
        ) {
          const firstThreeIds = loadedCustomers.slice(0, 3).map((c) => String(c.id));
          return [
            {
              ...prevRoutes[0],
              customerIds: firstThreeIds,
            },
          ];
        }
        return prevRoutes;
      });
    } catch (err) {
      addToast('Error loading data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // Helper to find all routes a customer belongs to
  const getCustomerRoutes = (customerId) => {
    const cid = String(customerId);
    return routes.filter((r) => r.customerIds && r.customerIds.includes(cid));
  };

  // Helper for single route fallback
  const getCustomerRoute = (customerId) => {
    const assigned = getCustomerRoutes(customerId);
    return assigned[0] || null;
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

  // Filtered customer list for the Customer History top selector
  const filteredHistoryCustomerOptions = useMemo(() => {
    const q = customerSearchInput.toLowerCase().trim();
    if (!q || (selectedHistoryCustomer && q === (selectedHistoryCustomer.name || '').toLowerCase().trim())) {
      return customers;
    }
    return customers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const code = (c.code || c.customerCode || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const route = getCustomerRoute(c.id)?.name?.toLowerCase() || '';
      return name.includes(q) || code.includes(q) || phone.includes(q) || route.includes(q);
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

  // Raw Customer Invoices
  const rawCustomerInvoices = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    let invoices = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INVOICES);
      invoices = saved ? JSON.parse(saved) : DEFAULT_SAMPLE_INVOICES;
    } catch (e) {
      invoices = DEFAULT_SAMPLE_INVOICES;
    }
    return invoices.filter((inv) =>
      matchesCustomer(inv.customerId, inv.customerName, inv.customerCode)
    );
  }, [selectedHistoryCustomer]);

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

  // Raw Customer Advance Payments
  const rawCustomerAdvances = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    let advances = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ADVANCES);
      advances = saved ? JSON.parse(saved) : DEFAULT_SAMPLE_ADVANCES;
    } catch (e) {
      advances = DEFAULT_SAMPLE_ADVANCES;
    }
    return advances.filter((adv) =>
      matchesCustomer(adv.customerId, adv.customerName)
    );
  }, [selectedHistoryCustomer]);

  // Filtered Customer Advance Payments
  const filteredCustomerAdvances = useMemo(() => {
    return rawCustomerAdvances.filter((adv) => {
      if (advanceStatusFilter !== 'ALL') {
        if ((adv.status || '').toUpperCase() !== advanceStatusFilter.toUpperCase()) return false;
      }
      if (advanceSearchQuery.trim()) {
        const q = advanceSearchQuery.toLowerCase().trim();
        const num = (adv.voucherNo || adv.id || '').toLowerCase();
        const pm = (adv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !pm.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerAdvances, advanceStatusFilter, advanceSearchQuery]);

  // Raw Customer Payments
  const rawCustomerPayments = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    let payments = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAYMENTS);
      payments = saved ? JSON.parse(saved) : DEFAULT_SAMPLE_PAYMENTS;
    } catch (e) {
      payments = DEFAULT_SAMPLE_PAYMENTS;
    }
    return payments.filter((pmt) =>
      matchesCustomer(pmt.customerId, pmt.customerName)
    );
  }, [selectedHistoryCustomer]);

  // Filtered Customer Payments
  const filteredCustomerPayments = useMemo(() => {
    return rawCustomerPayments.filter((pmt) => {
      if (paymentStatusFilter !== 'ALL') {
        if ((pmt.status || '').toUpperCase() !== paymentStatusFilter.toUpperCase()) return false;
      }
      if (paymentSearchQuery.trim()) {
        const q = paymentSearchQuery.toLowerCase().trim();
        const rec = (pmt.receiptNo || pmt.id || '').toLowerCase();
        const inv = (pmt.invoiceNo || '').toLowerCase();
        const pm = (pmt.paymentMethod || '').toLowerCase();
        if (!rec.includes(q) && !inv.includes(q) && !pm.includes(q)) return false;
      }
      return true;
    });
  }, [rawCustomerPayments, paymentStatusFilter, paymentSearchQuery]);

  // Raw Customer Cheques
  const rawCustomerCheques = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    let cheques = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHEQUES);
      cheques = saved ? JSON.parse(saved) : DEFAULT_SAMPLE_CHEQUES;
    } catch (e) {
      cheques = DEFAULT_SAMPLE_CHEQUES;
    }
    return cheques.filter((chq) =>
      matchesCustomer(chq.customerId, chq.customerName)
    );
  }, [selectedHistoryCustomer]);

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
  }, [customers, statusFilter, searchTerm, routes]);

  // Filtered Routes based on route search term
  const filteredRoutes = useMemo(() => {
    const q = routeSearchTerm.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const assignedSalesman = salesmen.find((s) => String(s.id) === String(r.salesmanId));
      const repName = (r.salesmanName || assignedSalesman?.name || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return name.includes(q) || repName.includes(q) || desc.includes(q);
    });
  }, [routes, routeSearchTerm, salesmen]);

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
      routeIds: [],
    });
    setShowCustomerModal(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (c) => {
    setEditingCustomer(c);
    const assignedRoutes = getCustomerRoutes(c.id);
    setCustomerForm({
      code: c.code || c.customerCode || '',
      name: c.name || '',
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '0',
      routeIds: assignedRoutes.map((r) => r.id),
    });
    setShowCustomerModal(true);
  };

  // Save Customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      addToast('Customer Name is required', 'error');
      return;
    }

    try {
      setSavingCustomer(true);
      const payload = {
        code: customerForm.code.trim().toUpperCase(),
        customerCode: customerForm.code.trim().toUpperCase(),
        name: customerForm.name.trim(),
        contactPerson: customerForm.contactPerson.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim(),
        address: customerForm.address.trim(),
        creditLimit: parseFloat(customerForm.creditLimit) || 0,
      };

      let savedCustomerId = null;
      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, payload);
        savedCustomerId = String(editingCustomer.id);
        addToast('Customer updated successfully', 'success');
      } else {
        const res = await customerApi.create(payload);
        savedCustomerId = String(res.data?.id);
        addToast('Customer created successfully', 'success');
      }

      // Update Route assignments
      if (savedCustomerId) {
        const selectedRouteIds = customerForm.routeIds || [];
        setRoutes((prevRoutes) => {
          return prevRoutes.map((r) => {
            const hasC = r.customerIds && r.customerIds.includes(savedCustomerId);
            const shouldHave = selectedRouteIds.includes(r.id);
            if (shouldHave && !hasC) {
              return { ...r, customerIds: [...(r.customerIds || []), savedCustomerId] };
            } else if (!shouldHave && hasC) {
              return { ...r, customerIds: (r.customerIds || []).filter((id) => id !== savedCustomerId) };
            }
            return r;
          });
        });
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
  // High-Security Deletion System
  // -------------------------------------------------------------
  const handleInitiateDeleteCustomer = (c) => {
    setSecurityModalData({
      type: 'customer',
      item: c,
      entityName: c.name,
      entityCode: c.code || c.customerCode || '—',
    });
  };

  const handleInitiateDeleteRoute = (route) => {
    setSecurityModalData({
      type: 'route',
      item: route,
      entityName: route.name,
      entityCode: route.id,
    });
  };

  const handleDeleteCustomer = (c) => {
    handleInitiateDeleteCustomer(c);
  };

  const handleExecuteSecureDelete = async () => {
    if (!securityModalData) return;
    try {
      setIsExecutingDelete(true);
      if (securityModalData.type === 'customer') {
        const c = securityModalData.item;
        setDeletingCustomerId(c.id);
        await customerApi.delete(c.id);
        addToast(`Customer "${c.name}" deleted successfully.`, 'success');
        const cid = String(c.id);
        setRoutes((prev) => prev.map((r) => ({ ...r, customerIds: (r.customerIds || []).filter((id) => id !== cid) })));
        if (viewingCustomer?.id === c.id) {
          setViewingCustomer(null);
        }
        loadInitialData();
      } else if (securityModalData.type === 'route') {
        const r = securityModalData.item;
        setRoutes((prev) => prev.filter((route) => route.id !== r.id));
        addToast(`Route "${r.name}" deleted successfully.`, 'success');
        if (selectedRoute?.id === r.id) {
          setSelectedRoute(null);
          setIsCreatingRoute(false);
        }
      }
      setSecurityModalData(null);
    } catch (err) {
      addToast('Deletion failed: ' + (err.message || 'Server error'), 'error');
    } finally {
      setIsExecutingDelete(false);
      setDeletingCustomerId(null);
    }
  };

  // -------------------------------------------------------------
  // Route / Group Management Actions (Inline View - No Popups)
  // -------------------------------------------------------------
  const handleOpenRouteView = (route) => {
    setSelectedRoute(route);
    setIsCreatingRoute(false);
    setRouteEditForm({
      name: route.name,
      description: route.description || '',
      salesmanId: route.salesmanId || '',
      selectedCustomerIds: route.customerIds ? [...route.customerIds] : [],
    });
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleOpenCreateRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(true);
    setRouteEditForm({
      name: `Route ${routes.length + 1}`,
      description: '',
      salesmanId: '',
      selectedCustomerIds: [],
    });
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleCloseRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(false);
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleSaveRouteView = (e) => {
    if (e) e.preventDefault();
    if (!routeEditForm.name.trim()) {
      addToast('Route name is required', 'error');
      return;
    }

    const assignedSalesman = salesmen.find((s) => String(s.id) === String(routeEditForm.salesmanId));
    const salesmanName = assignedSalesman?.name || '';

    if (isCreatingRoute) {
      const newRoute = {
        id: 'route-' + Date.now(),
        name: routeEditForm.name.trim(),
        description: routeEditForm.description.trim(),
        salesmanId: routeEditForm.salesmanId || '',
        salesmanName,
        customerIds: routeEditForm.selectedCustomerIds || [],
        createdAt: new Date().toISOString(),
      };

      setRoutes((prev) => [...prev, newRoute]);
      addToast(`Route "${newRoute.name}" created successfully!`, 'success');
    } else if (selectedRoute) {
      setRoutes((prev) =>
        prev.map((r) => {
          if (r.id === selectedRoute.id) {
            return {
              ...r,
              name: routeEditForm.name.trim(),
              description: routeEditForm.description.trim(),
              salesmanId: routeEditForm.salesmanId || '',
              salesmanName,
              customerIds: routeEditForm.selectedCustomerIds || [],
            };
          }
          return r;
        })
      );
      addToast(`Route "${routeEditForm.name}" updated successfully!`, 'success');
    }

    handleCloseRouteView();
  };

  const handleDeleteCurrentRoute = () => {
    if (!selectedRoute) return;
    handleInitiateDeleteRoute(selectedRoute);
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

  // Available customers for Assign Customer popup
  const availableCustomersToAssign = useMemo(() => {
    if (!showAssignCustomerModal) return [];
    const q = assignCustomerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q))
    );
  }, [customers, assignCustomerSearch, showAssignCustomerModal]);

  // Export CSV matching EmployeesHub style
  const handleExportCSV = () => {
    if (customers.length === 0) {
      addToast('No customers to export', 'error');
      return;
    }
    const headers = ['Code', 'Name', 'Routes', 'Contact Person', 'Phone', 'Email', 'Credit Limit', 'Current Balance', 'Status'];
    const rows = customers.map((c) => {
      const assignedRoutes = getCustomerRoutes(c.id);
      const routeNames = assignedRoutes.map((r) => r.name).join('; ') || 'Unassigned';
      return [
        `"${(c.code || c.customerCode || '').replace(/"/g, '""')}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${routeNames.replace(/"/g, '""')}"`,
        `"${(c.contactPerson || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
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

  // Export Routes to CSV
  const handleExportRoutesCSV = () => {
    if (routes.length === 0) {
      addToast('No routes to export', 'error');
      return;
    }
    const headers = ['Route Name', 'Assigned Representative', 'Total Customers', 'Description', 'Created Date'];
    const rows = (filteredRoutes.length > 0 ? filteredRoutes : routes).map((r) => {
      const assignedSalesman = salesmen.find((s) => String(s.id) === String(r.salesmanId));
      const repName = r.salesmanName || assignedSalesman?.name || 'Unassigned';
      const count = r.customerIds?.length || 0;
      const createdDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—';
      return [
        `"${(r.name || '').replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `customer_routes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Routes exported to CSV', 'success');
  };

  const isFiltered = Boolean(searchTerm.trim() || statusFilter !== 'ALL');
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
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
            Create and manage customer records, credit limits, delivery routes, and transaction history.
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
          <Users size={16} /> Groups & Routes
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
          {/* Top Filter & Actions Bar (Fixed / Sticky to Desktop Screen) */}
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
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
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
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Filters (to the left of Export CSV), Export CSV (icon only), & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 30px 0 12px',
                  width: '135px',
                  minWidth: '115px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
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
                    height: '38px',
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

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
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
                title="Export customers to CSV"
              >
                <Download size={14} /> Export
              </button>

              {/* Refresh Customer Records */}
              <button
                type="button"
                onClick={loadInitialData}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
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
                title="Refresh customer records"
              >
                <RefreshCw size={14} /> Refresh
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
              <table style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CUSTOMER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ROUTE / GROUP
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CONTACT PERSON
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      PHONE NUMBER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CREDIT LIMIT
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      BALANCE
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
                                      <MapPin size={11} color="#2563eb" /> {r.name}
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

                          <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem', fontWeight: 500, textAlign: 'right' }}>
                            LKR {Number(c.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '12px 14px', fontSize: '0.84rem', fontWeight: 600, textAlign: 'right', color: Number(c.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                            LKR {Number(c.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '12px 12px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCustomerActive(c.id, active);
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
                              title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
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
                                  border: '1px solid #cbd5e1',
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInitiateDeleteCustomer(c);
                                }}
                                disabled={deletingCustomerId === c.id}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#dc2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Delete Customer from Database"
                              >
                                <Trash2 size={13} />
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
                Customer Groups & Routes
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                Organize customers into targeted delivery routes, pricing groups, or sales territories.
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
              <Plus size={16} /> Create Group / Route
            </button>
          </div>

          {/* Routes Toolbar: Search Input + Export CSV Icon */}
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
            }}
          >
            {/* Search bar filling width */}
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
                placeholder="Search routes by name, representative, description..."
                value={routeSearchTerm}
                onChange={(e) => setRouteSearchTerm(e.target.value)}
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
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Export CSV Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleExportRoutesCSV}
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
                  e.currentTarget.style.color = '#64748b';
                }}
                title="Export routes to CSV"
              >
                <Download size={15} />
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
                No customer routes or groups found matching current search.
              </div>
            ) : (
              filteredRoutes.map((route) => {
              const count = route.customerIds?.length || 0;
              const assignedSalesman = salesmen.find((s) => String(s.id) === String(route.salesmanId));
              const repName = route.salesmanName || assignedSalesman?.name;

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
                    {/* Card Top: Route Name & User Count Badge */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {route.name}
                      </h3>

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
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <Users size={12} />
                        {count} customer{count === 1 ? '' : 's'}
                      </div>
                    </div>

                    {/* Description */}
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 10px 0' }}>
                      {route.description || 'No description added'}
                    </p>

                    {/* Sales Representative */}
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
                      <UserCheck size={14} color={repName ? '#0284c7' : '#94a3b8'} />
                      {repName ? `Sales Rep: ${repName}` : 'No sales representative assigned'}
                    </p>
                  </div>

                  {/* Card Footer: count & Manage link (Delete icon removed as requested) */}
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
                      Manage Group / Route →
                    </span>
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
        <div className="modal-backdrop" onClick={handleCloseRouteView}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1040px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              height: 'min(640px, 86vh)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                  {isCreatingRoute ? 'Create Group / Route' : `Manage Route: ${routeEditForm.name}`}
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

            {/* Modal Body: Split into Two Columns */}
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
              {/* LEFT COLUMN: Text Fields & Settings (Sticky/Fixed - No Scroll) */}
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
                    Route Details
                  </div>

                  {/* Route Name Input */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Route / Group Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Route 1 - Colombo Central"
                      value={routeEditForm.name}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, name: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Sales Rep Dropdown */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Assigned Sales Representative
                    </label>
                    <select
                      value={routeEditForm.salesmanId}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, salesmanId: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 28px 0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                      }}
                    >
                      <option value="">None (Unassigned)</option>
                      {salesmen.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.salesmanCode || 'Sales Rep'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Description / Territory Notes
                    </label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Daily retail delivery route covering Central Business District"
                      value={routeEditForm.description}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.86rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {/* Left Column Delete Button if editing */}
                {!isCreatingRoute && (
                  <div>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentRoute}
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#ffffff',
                        color: '#dc2626',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fef2f2';
                        e.currentTarget.style.borderColor = '#dc2626';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#fecaca';
                      }}
                    >
                      <Trash2 size={14} /> Delete this Route
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Assigned Customers Table & Workspace */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  minHeight: 0,
                  height: '100%',
                }}
              >
                {/* Top Row: Small Route Summary on Table Side & Assign Customer Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  {/* Small Route Summary */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      Route Summary:
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
                      {routeEditForm.selectedCustomerIds.length} Assigned Customer{routeEditForm.selectedCustomerIds.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Assign Customer Button (Opens Small Popup) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignCustomerModal(true);
                      setAssignCustomerSearch('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      height: '34px',
                      borderRadius: '6px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                      transition: 'background-color 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                  >
                    <Plus size={14} /> Assign Customer
                  </button>
                </div>

                {/* Table Side Search with Small Icon */}
                <div style={{ position: 'relative', width: '100%' }}>
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
                    placeholder="Search assigned customers..."
                    value={customerSearchInRoute}
                    onChange={(e) => setCustomerSearchInRoute(e.target.value)}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 28px 0 30px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
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
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Assigned Customers Table Container (Only Data Rows Scroll, Header is Sticky) */}
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
                                  title="Remove customer from route"
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

            {/* Modal Footer */}
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
                onClick={handleCloseRouteView}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
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
                <Check size={16} /> {isCreatingRoute ? 'Save New Route' : 'Update Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SMALL POPUP: Search & Assign Customers to Route               */}
      {/* ------------------------------------------------------------- */}
      {showAssignCustomerModal && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100, backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          onClick={() => setShowAssignCustomerModal(false)}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.25), 0 10px 15px -6px rgba(15, 23, 42, 0.1)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Assign Customers
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Search and add customers to {routeEditForm.name || 'this route'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignCustomerModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
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
                  placeholder="Search by name, code, phone..."
                  value={assignCustomerSearch}
                  onChange={(e) => setAssignCustomerSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 28px 0 32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {assignCustomerSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignCustomerSearch('')}
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
            </div>

            {/* Customers List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', maxHeight: '360px' }}>
              {availableCustomersToAssign.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No matching customers found.
                </div>
              ) : (
                availableCustomersToAssign.map((c) => {
                  const isAssigned = routeEditForm.selectedCustomerIds.includes(String(c.id));
                  const otherRoutes = routes.filter(
                    (r) => r.id !== (selectedRoute?.id) && r.customerIds && r.customerIds.includes(String(c.id))
                  );

                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{c.code || c.customerCode}</span>
                            {c.phone && <span>• {c.phone}</span>}
                            {otherRoutes.length > 0 && (
                              <span style={{ color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 500 }}>
                                Also in: {otherRoutes.map((r) => r.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isAssigned) {
                            setRouteEditForm({
                              ...routeEditForm,
                              selectedCustomerIds: routeEditForm.selectedCustomerIds.filter((id) => id !== String(c.id)),
                            });
                          } else {
                            setRouteEditForm({
                              ...routeEditForm,
                              selectedCustomerIds: [...routeEditForm.selectedCustomerIds, String(c.id)],
                            });
                          }
                        }}
                        style={{
                          marginLeft: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '5px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isAssigned ? '1px solid #bbf7d0' : 'none',
                          backgroundColor: isAssigned ? '#f0fdf4' : '#0284c7',
                          color: isAssigned ? '#15803d' : '#ffffff',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isAssigned ? (
                          <>
                            <Check size={12} /> Assigned
                          </>
                        ) : (
                          <>
                            <Plus size={12} /> Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a' }}>{routeEditForm.selectedCustomerIds.length}</strong> customer{routeEditForm.selectedCustomerIds.length === 1 ? '' : 's'} in route
              </span>
              <button
                type="button"
                onClick={() => setShowAssignCustomerModal(false)}
                style={{
                  padding: '6px 18px',
                  borderRadius: '6px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
              {/* TOP SEARCH & ACTIONS TOOLBAR - All in ONE line: Search bar, Full Profile, Edit */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  position: 'relative',
                }}
              >
                {/* Search Bar with Autocomplete Suggestions Dropdown */}
                <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search
                    size={16}
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
                    placeholder="Search customer by code, name, phone, or route to view history..."
                    value={customerSearchInput}
                    onChange={(e) => {
                      setCustomerSearchInput(e.target.value);
                      setIsCustomerSearchOpen(true);
                    }}
                    onFocus={() => setIsCustomerSearchOpen(true)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 32px 0 36px',
                      borderRadius: '6px',
                      border: isCustomerSearchOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
                      fontSize: '0.88rem',
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
                        top: '10px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: '2px',
                      }}
                      title="Clear customer selection"
                    >
                      <X size={15} />
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
                        border: '1px solid #cbd5e1',
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
                                    🗺️ {route.name}
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
                                {isSelected && <Check size={14} color="#0284c7" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Full Profile and Edit buttons in ONE LINE */}
                {selectedHistoryCustomer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setViewingCustomer(selectedHistoryCustomer)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                        whiteSpace: 'nowrap',
                      }}
                      title="View Full Customer Profile"
                    >
                      <Users size={14} /> Full Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(selectedHistoryCustomer)}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                        whiteSpace: 'nowrap',
                      }}
                      title="Edit Customer Details"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
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
                  {/* COMPACT SINGLE-LINE CUSTOMER SUMMARY BAR (No profile avatar circle, small & sleek) */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '8px 14px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      flexShrink: 0,
                      minHeight: '40px',
                    }}
                  >
                    {/* Left: Essential Customer Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '0.92rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedHistoryCustomer.name}
                      </span>

                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedHistoryCustomer.code || selectedHistoryCustomer.customerCode || 'NO CODE'}
                      </span>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: isCustomerActive(selectedHistoryCustomer) ? '#dcfce7' : '#fee2e2',
                          color: isCustomerActive(selectedHistoryCustomer) ? '#15803d' : '#b91c1c',
                          border: isCustomerActive(selectedHistoryCustomer) ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isCustomerActive(selectedHistoryCustomer) ? 'Active' : 'Inactive'}
                      </span>

                      <span style={{ color: '#cbd5e1', userSelect: 'none' }}>|</span>

                      {selectedHistoryCustomer.phone && (
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Phone size={12} color="#94a3b8" /> {selectedHistoryCustomer.phone}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <MapPin size={12} color="#94a3b8" /> Route: <strong style={{ color: '#0f172a' }}>{getCustomerRoute(selectedHistoryCustomer.id)?.name || 'Unassigned'}</strong>
                      </span>
                    </div>

                    {/* Right: Inline Financial KPI Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Invoiced:</span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          LKR {customerHistoryMetrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', textTransform: 'uppercase', fontWeight: 600 }}>Total Paid:</span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                          LKR {customerHistoryMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: customerHistoryMetrics.outstandingBalance > 0 ? '#fef2f2' : '#f8fafc',
                          borderRadius: '6px',
                          border: customerHistoryMetrics.outstandingBalance > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', color: customerHistoryMetrics.outstandingBalance > 0 ? '#dc2626' : '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding:</span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: customerHistoryMetrics.outstandingBalance > 0 ? '#dc2626' : '#0f172a', fontFamily: 'monospace' }}>
                          LKR {customerHistoryMetrics.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

              {/* SUBTABS NAVIGATION (Matches User Screenshot) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '0 4px',
                  marginTop: '4px',
                  flexShrink: 0,
                }}
              >
                {[
                  { id: 'invoices', label: `Invoices (${rawCustomerInvoices.length})` },
                  { id: 'advances', label: `Advance Payments (${rawCustomerAdvances.length})` },
                  { id: 'payments', label: `Payments (${rawCustomerPayments.length})` },
                  { id: 'cheques', label: `Cheques (${rawCustomerCheques.length})` },
                  { id: 'outstanding', label: `Outstanding (${rawCustomerOutstanding.length})` },
                ].map((tab) => {
                  const isSel = historyTableTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistoryTableTab(tab.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: isSel ? '2.5px solid #0284c7' : '2.5px solid transparent',
                        padding: '10px 4px',
                        fontSize: '0.92rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? '#0284c7' : '#64748b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '-1px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: INVOICES TABLE (Matches User Screenshot!) */}
              {historyTableTab === 'invoices' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                  {/* Invoices Toolbar */}
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
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search invoice #..."
                        value={invoiceSearchQuery}
                        onChange={(e) => setInvoiceSearchQuery(e.target.value)}
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
                      {invoiceSearchQuery && (
                        <button type="button" onClick={() => setInvoiceSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <select
                        value={invoiceStatusFilter}
                        onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                        style={{
                          height: '38px',
                          padding: '0 30px 0 12px',
                          width: '135px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
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
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PAID">Paid</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="UNPAID">Unpaid</option>
                      </select>

                      {(invoiceSearchQuery || invoiceStatusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setInvoiceSearchQuery(''); setInvoiceStatusFilter('ALL'); }}
                          style={{
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '0.85rem',
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
                        onClick={() => handleExportTableCSV('invoices')}
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
                        title="Export invoices to CSV"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

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
                                        border: '1px solid #cbd5e1',
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
                                      <Eye size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Table Footer Summary */}
                    <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Showing <strong>{filteredCustomerInvoices.length}</strong> of <strong>{rawCustomerInvoices.length}</strong> invoices</span>
                      <span>Total Invoiced: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>LKR {filteredCustomerInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADVANCE PAYMENTS TABLE */}
              {historyTableTab === 'advances' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
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
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search voucher #..."
                        value={advanceSearchQuery}
                        onChange={(e) => setAdvanceSearchQuery(e.target.value)}
                        style={{ width: '100%', height: '38px', padding: '0 32px 0 38px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                      {advanceSearchQuery && (
                        <button type="button" onClick={() => setAdvanceSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <select
                        value={advanceStatusFilter}
                        onChange={(e) => setAdvanceStatusFilter(e.target.value)}
                        style={{
                          height: '38px',
                          padding: '0 30px 0 12px',
                          width: '135px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="UTILIZED">Utilized</option>
                      </select>

                      {(advanceSearchQuery || advanceStatusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setAdvanceSearchQuery(''); setAdvanceStatusFilter('ALL'); }}
                          style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={13} /> Reset
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportTableCSV('advances')}
                        style={{ height: '38px', width: '38px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: 0, color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Export advance payments to CSV"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

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
                                      style={{ border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="View advance voucher details"
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Showing <strong>{filteredCustomerAdvances.length}</strong> of <strong>{rawCustomerAdvances.length}</strong> advance vouchers</span>
                      <span>Total Advances: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>LKR {filteredCustomerAdvances.reduce((s, a) => s + Number(a.amount || 0), 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYMENTS TABLE */}
              {historyTableTab === 'payments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
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
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search receipt # or invoice #..."
                        value={paymentSearchQuery}
                        onChange={(e) => setPaymentSearchQuery(e.target.value)}
                        style={{ width: '100%', height: '38px', padding: '0 32px 0 38px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                      {paymentSearchQuery && (
                        <button type="button" onClick={() => setPaymentSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <select
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                        style={{
                          height: '38px',
                          padding: '0 30px 0 12px',
                          width: '135px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="CLEARED">Cleared</option>
                        <option value="RECEIVED">Received</option>
                      </select>

                      {(paymentSearchQuery || paymentStatusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setPaymentSearchQuery(''); setPaymentStatusFilter('ALL'); }}
                          style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={13} /> Reset
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportTableCSV('payments')}
                        style={{ height: '38px', width: '38px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: 0, color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Export payments to CSV"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

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
                                    style={{ border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="View receipt details"
                                  >
                                    <Eye size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Showing <strong>{filteredCustomerPayments.length}</strong> of <strong>{rawCustomerPayments.length}</strong> payment receipts</span>
                      <span>Total Payments: <strong style={{ color: '#16a34a', fontFamily: 'monospace' }}>LKR {filteredCustomerPayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CHEQUES TABLE */}
              {historyTableTab === 'cheques' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
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
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search cheque #, bank name..."
                        value={chequeSearchQuery}
                        onChange={(e) => setChequeSearchQuery(e.target.value)}
                        style={{ width: '100%', height: '38px', padding: '0 32px 0 38px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                      {chequeSearchQuery && (
                        <button type="button" onClick={() => setChequeSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <select
                        value={chequeStatusFilter}
                        onChange={(e) => setChequeStatusFilter(e.target.value)}
                        style={{
                          height: '38px',
                          padding: '0 30px 0 12px',
                          width: '135px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="CLEARED">Cleared</option>
                        <option value="PENDING">Pending</option>
                        <option value="DEPOSITED">Deposited</option>
                        <option value="BOUNCED">Bounced</option>
                      </select>

                      {(chequeSearchQuery || chequeStatusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setChequeSearchQuery(''); setChequeStatusFilter('ALL'); }}
                          style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={13} /> Reset
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportTableCSV('cheques')}
                        style={{ height: '38px', width: '38px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: 0, color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Export cheques to CSV"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

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
                                      style={{ border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="View cheque details"
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Showing <strong>{filteredCustomerCheques.length}</strong> of <strong>{rawCustomerCheques.length}</strong> cheques</span>
                      <span>Total Cheques Amount: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>LKR {filteredCustomerCheques.reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: OUTSTANDING PAYMENTS TABLE */}
              {historyTableTab === 'outstanding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
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
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search outstanding invoice #..."
                        value={outstandingSearchQuery}
                        onChange={(e) => setOutstandingSearchQuery(e.target.value)}
                        style={{ width: '100%', height: '38px', padding: '0 32px 0 38px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                      {outstandingSearchQuery && (
                        <button type="button" onClick={() => setOutstandingSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <select
                        value={outstandingStatusFilter}
                        onChange={(e) => setOutstandingStatusFilter(e.target.value)}
                        style={{
                          height: '38px',
                          padding: '0 30px 0 12px',
                          width: '135px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="UNPAID">Unpaid</option>
                      </select>

                      {(outstandingSearchQuery || outstandingStatusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setOutstandingSearchQuery(''); setOutstandingStatusFilter('ALL'); }}
                          style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={13} /> Reset
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportTableCSV('outstanding')}
                        style={{ height: '38px', width: '38px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: 0, color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Export outstanding payments to CSV"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

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
                                      style={{ border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="View outstanding invoice details"
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Showing <strong>{filteredCustomerOutstanding.length}</strong> of <strong>{rawCustomerOutstanding.length}</strong> pending invoices</span>
                      <span>Total Pending Balance: <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>LKR {filteredCustomerOutstanding.reduce((s, i) => s + Number(i.balanceAmount || 0), 0).toFixed(2)}</strong></span>
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
        <div className="modal-backdrop" onClick={() => setViewingCustomer(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '740px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
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
                        return <span>Route: <strong style={{ color: '#334155' }}>Unassigned</strong></span>;
                      }
                      return (
                        <span>
                          Routes: <strong style={{ color: '#334155' }}>{cRoutes.map((r) => r.name).join(', ')}</strong>
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
                    border: '1px solid #cbd5e1',
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
                  onClick={() => {
                    const c = viewingCustomer;
                    setViewingCustomer(null);
                    handleInitiateDeleteCustomer(c);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} /> Delete
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
                  Route & Logistics
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                      Assigned Route(s)
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
                              <MapPin size={11} color="#2563eb" /> {r.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Sales Representative(s)</span>
                    <span style={{ fontWeight: 500, color: '#0f172a' }}>
                      {(() => {
                        const cRoutes = getCustomerRoutes(viewingCustomer.id);
                        const reps = [...new Set(cRoutes.map((r) => r.salesmanName).filter(Boolean))];
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
                <History size={14} /> View Financial History
              </button>

              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
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
        <div className="modal-backdrop" onClick={() => setPreviewModalDoc(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
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
        <div className="modal-backdrop" onClick={() => setShowCustomerModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '800px',
              padding: '28px 32px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
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
      {/* SIMPLE & USER-FRIENDLY DELETE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {securityModalData && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={() => !isExecutingDelete && setSecurityModalData(null)}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.25), 0 10px 15px -6px rgba(15, 23, 42, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Icon */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  {securityModalData.type === 'route' ? 'Delete Route' : 'Delete Customer'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: '#0f172a' }}>{securityModalData.entityName}</strong>? This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isExecutingDelete && setSecurityModalData(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                disabled={isExecutingDelete}
                onClick={() => setSecurityModalData(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: isExecutingDelete ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingDelete}
                onClick={handleExecuteSecureDelete}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: isExecutingDelete ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => !isExecutingDelete && (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={(e) => !isExecutingDelete && (e.currentTarget.style.backgroundColor = '#dc2626')}
              >
                <Trash2 size={15} />
                {isExecutingDelete ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
