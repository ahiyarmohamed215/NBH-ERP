import {useDataSync} from '../hooks/useDataSync';
import StatusBadge from '../components/StatusBadge';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  customerMonthlyRangeApi,
  salesmanApi,
} from '../api/apiClient';
import {
  Target,
  Award,
  TrendingUp,
  Users,
  Calendar,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Download,
  RefreshCw,
  ChevronRight,
  X,
  User,
  Sliders,
  Layers,
  Sparkles,
  FileText,
  Check,
  Eye,
  Percent,
  Clock,
  ShieldCheck,
  UserCheck,
  Printer,
} from 'lucide-react';
import CustomerTargetsTab from './CustomerTargetsTab';

export default function CustomerMonthlyRangeHub({
  customers = [],
  salesmen = [],
  routes = [],
  canEdit = true,
  addToast,
}) {
  // Navigation: 'dashboard' (Screen C) | 'setup' (Screen A) | 'reports' (Screen D) | 'campaigns' (V5 Campaigns)
  const [subTab, setSubTab] = useState('dashboard');

  // Month selector (format YYYY-MM)
  const currentYearMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);

  // =========================================================================
  // State: Screen C - Customer Range Dashboard
  // =========================================================================
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError,setDashboardError]=useState('');
  const [syncingMonth,setSyncingMonth]=useState(false);
  const [dashSearch, setDashSearch] = useState('');
  const [dashRangeFilter, setDashRangeFilter] = useState('ALL');
  const [dashStaffFilter, setDashStaffFilter] = useState('ALL');
  const [dashNearTargetOnly, setDashNearTargetOnly] = useState(false);
  const [dashPage, setDashPage] = useState(0);
  const [dashPageSize, setDashPageSize] = useState(25);

  useEffect(()=>{setDashPage(0);},[selectedMonth,dashSearch,dashRangeFilter,dashStaffFilter]);

  // Customer History Modal
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Assign Staff Modal
  const [assigningCustomer, setAssigningCustomer] = useState(null);
  const [selectedNewStaffId, setSelectedNewStaffId] = useState('');
  const [savingAssignStaff, setSavingAssignStaff] = useState(false);

  // =========================================================================
  // State: Screen A - Range Setup & Audit
  // =========================================================================
  const [ranges, setRanges] = useState([]);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [editingRange, setEditingRange] = useState(null);
  const [savingRange, setSavingRange] = useState(false);
  const [rangeForm, setRangeForm] = useState({
    rangeCode: '',
    name: '',
    minSpend: '',
    displayOrder: 0,
    isActive: true,
    description: '',
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // =========================================================================
  // State: Screen D - Monthly Reports & Staff Performance
  // =========================================================================
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Sales staff options
  const [staffList, setStaffList] = useState(salesmen || []);

  useEffect(() => {
    if ((!salesmen || salesmen.length === 0)) {
      salesmanApi
        .getAll()
        .then((res) => {
          const list = res?.data?.data || res?.data || [];
          if (Array.isArray(list)) setStaffList(list);
        })
        .catch(() => {});
    } else {
      setStaffList(salesmen);
    }
  }, [salesmen]);

  // =========================================================================
  // Load Screen C: Manager Dashboard
  // =========================================================================
  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError('');
    try {
      const params = {
        yearMonth: selectedMonth,
        page: dashPage,
        size: dashPageSize,
      };
      if (dashStaffFilter !== 'ALL') params.staffId = dashStaffFilter;
      if (dashRangeFilter !== 'ALL') params.rangeId = dashRangeFilter;
      if (dashSearch.trim()) params.search = dashSearch.trim();

      const res = await customerMonthlyRangeApi.getManagerDashboard(params);
      const data = res?.data?.data || res?.data;
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading range dashboard:', err);
      setDashboardError(err.response?.data?.message || err.message || 'Unable to load customer ranges. Please retry.');
    } finally {
      setLoadingDashboard(false);
    }
  }, [selectedMonth, dashPage, dashPageSize, dashStaffFilter, dashRangeFilter, dashSearch, addToast]);

  useEffect(() => {
    if (subTab === 'dashboard') {
      loadDashboard();
    }
  }, [subTab, loadDashboard]);

  // =========================================================================
  // Load Screen A: Range Configuration
  // =========================================================================
  const loadRanges = useCallback(async () => {
    setLoadingRanges(true);
    try {
      const res = await customerMonthlyRangeApi.getAllRanges();
      const list = res?.data?.data || res?.data || [];
      setRanges(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error loading ranges:', err);
      if (addToast) addToast('Failed to load range configurations', 'error');
    } finally {
      setLoadingRanges(false);
    }
  }, [addToast]);

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await customerMonthlyRangeApi.getAuditTrail();
      const logs = res?.data?.data || res?.data || [];
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setShowAuditModal(true);
    } catch (err) {
      if (addToast) addToast('Unable to load range audit trail', 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (subTab === 'setup') {
      loadRanges();
    }
  }, [subTab, loadRanges]);

  // =========================================================================
  // Load Screen D: Monthly Reports & Staff Performance
  // =========================================================================
  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await customerMonthlyRangeApi.getStaffPerformance(selectedMonth);
      const list = res?.data?.data || res?.data || [];
      setStaffPerformance(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error loading staff performance report:', err);
      if (addToast) addToast('Failed to load monthly range report', 'error');
    } finally {
      setLoadingReports(false);
    }
  }, [selectedMonth, addToast]);

  useEffect(() => {
    if (subTab === 'reports') {
      loadReports();
      loadDashboard();
    }
  }, [subTab, selectedMonth, loadReports, loadDashboard]);

  useDataSync(() => {
    if (subTab === 'dashboard') return loadDashboard();
    if (subTab === 'setup') return loadRanges();
    if (subTab === 'reports') return loadReports();
  }, ['erp:sales_updated','erp:targets_updated'], [], ['sales','targets','customers','users']);

  // =========================================================================
  // Screen A Actions: Range CRUD & Status Toggle
  // =========================================================================
  const handleOpenCreateRange = () => {
    setEditingRange(null);
    setRangeForm({
      rangeCode: `RANGE_${ranges.length}`,
      name: `Range ${ranges.length}`,
      minSpend: '',
      displayOrder: ranges.length,
      isActive: true,
      description: '',
    });
    setShowRangeModal(true);
  };

  const handleOpenEditRange = (r) => {
    setEditingRange(r);
    setRangeForm({
      rangeCode: r.rangeCode,
      name: r.name,
      minSpend: String(r.minSpend),
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      description: r.description || '',
    });
    setShowRangeModal(true);
  };

  const handleSaveRange = async (e) => {
    e.preventDefault();
    if (!rangeForm.name.trim()) {
      if (addToast) addToast('Range name is required', 'warning');
      return;
    }
    const spendNum = parseFloat(rangeForm.minSpend);
    if (isNaN(spendNum) || spendNum < 0) {
      if (addToast) addToast('Monthly threshold must be a non-negative number', 'warning');
      return;
    }

    setSavingRange(true);
    try {
      if (editingRange) {
        await customerMonthlyRangeApi.updateRange(editingRange.id, {
          name: rangeForm.name.trim(),
          minSpend: spendNum,
          displayOrder: Number(rangeForm.displayOrder),
          isActive: rangeForm.isActive,
          description: rangeForm.description.trim(),
        });
        if (addToast) addToast(`Range '${rangeForm.name}' updated successfully!`, 'success');
      } else {
        await customerMonthlyRangeApi.createRange({
          rangeCode: rangeForm.rangeCode.trim(),
          name: rangeForm.name.trim(),
          minSpend: spendNum,
          displayOrder: Number(rangeForm.displayOrder),
          isActive: rangeForm.isActive,
          description: rangeForm.description.trim(),
        });
        if (addToast) addToast(`Range '${rangeForm.name}' created successfully!`, 'success');
      }
      setShowRangeModal(false);
      loadRanges();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Error saving range configuration';
      if (addToast) addToast(msg, 'error');
    } finally {
      setSavingRange(false);
    }
  };

  const handleToggleRangeStatus = async (r) => {
    if (r.rangeCode === 'RANGE_0' || r.displayOrder === 0) {
      if (addToast) addToast('Baseline Range 0 cannot be deactivated', 'warning');
      return;
    }
    try {
      await customerMonthlyRangeApi.toggleStatus(r.id, !r.isActive);
      if (addToast) addToast(`Range '${r.name}' is now ${!r.isActive ? 'Active' : 'Inactive'}`, 'success');
      loadRanges();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to update range status';
      if (addToast) addToast(msg, 'error');
    }
  };

  // =========================================================================
  // Screen C Actions: History View & Assign Staff
  // =========================================================================
  const handleViewCustomerHistory = async (customer) => {
    setHistoryCustomer(customer);
    setLoadingHistory(true);
    try {
      const res = await customerMonthlyRangeApi.getCustomerHistory(customer.customerId);
      const list = res?.data?.data || res?.data || [];
      setCustomerHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      if (addToast) addToast('Unable to load customer range history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenAssignStaff = (customer) => {
    setAssigningCustomer(customer);
    setSelectedNewStaffId(customer.assignedStaffId ? String(customer.assignedStaffId) : '');
  };

  const handleSaveAssignStaff = async () => {
    if (!assigningCustomer) return;
    setSavingAssignStaff(true);
    try {
      await customerMonthlyRangeApi.assignStaff(
        assigningCustomer.customerId,
        selectedNewStaffId ? Number(selectedNewStaffId) : null
      );
      if (addToast) addToast('Assigned staff updated successfully!', 'success');
      setAssigningCustomer(null);
      loadDashboard();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to assign staff';
      if (addToast) addToast(msg, 'error');
    } finally {
      setSavingAssignStaff(false);
    }
  };

  const handleSyncMonth = async () => {
    if(syncingMonth)return;
    setSyncingMonth(true);
    try {
      await customerMonthlyRangeApi.syncMonth(selectedMonth);
      if (addToast) addToast(`Month ${selectedMonth} ranges synchronized!`, 'success');
      loadDashboard();
    } catch (err) {
      if (addToast) addToast(err.response?.data?.message || err.message || 'Failed to synchronize monthly ranges', 'error');
    } finally {setSyncingMonth(false);}
  };

  // Client-side filtering for Near Target toggle
  const displayedCustomers = useMemo(() => {
    if (!dashboardData?.customers) return [];
    if (!dashNearTargetOnly) return dashboardData.customers;
    return dashboardData.customers.filter(
      (c) => c.isCloseToTarget && !c.isHighestRange
    );
  }, [dashboardData, dashNearTargetOnly]);

  // Export Dashboard to CSV
  const handleExportDashboardCSV = () => {
    if (!dashboardData?.customers || dashboardData.customers.length === 0) {
      if (addToast) addToast('No customer data available to export', 'warning');
      return;
    }
    const headers = [
      'Customer Code',
      'Customer Name',
      'Phone',
      'Assigned Staff',
      'Month Purchases (Rs.)',
      'Current Range',
      'Next Target (Rs.)',
      'Remaining to Next Range (Rs.)',
      'Progress %',
      'Status',
    ];
    const rows = (dashboardData.customers || []).map((c) => [
      `"${c.customerCode || ''}"`,
      `"${c.customerName || ''}"`,
      `"${c.customerPhone || ''}"`,
      `"${c.assignedStaffName || 'Unassigned'}"`,
      Number(c.monthlyPurchases || 0).toFixed(2),
      `"${c.currentRangeName || ''}"`,
      Number(c.nextTargetAmount || 0).toFixed(2),
      Number(c.remainingAmount || 0).toFixed(2),
      `${Number(c.progressPercentage || 0).toFixed(1)}%`,
      `"${c.isHighestRange ? 'Highest Tier' : c.isCloseToTarget ? 'Near Target' : 'In Progress'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Customer_Ranges_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast('Customer range report exported to CSV', 'success');
  };

  // Export Staff Performance to CSV
  const handleExportStaffCSV = () => {
    if (!staffPerformance || staffPerformance.length === 0) {
      if (addToast) addToast('No staff performance data available to export', 'warning');
      return;
    }
    const headers = [
      'Staff Name',
      'Username',
      'Assigned Customers',
      'Active Purchasers',
      'Promoted Customers (Range 1+)',
      'Total Qualifying Sales (Rs.)',
    ];
    const rows = staffPerformance.map((p) => [
      `"${p.staffName || ''}"`,
      `"${p.staffUsername || ''}"`,
      p.totalAssignedCustomers || 0,
      p.activePurchasingCustomers || 0,
      p.promotedCustomers || 0,
      Number(p.totalQualifyingPurchases || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Staff_Performance_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast('Staff performance report exported to CSV', 'success');
  };

  // Tier color styling helper (Matches clean pastel badges in Customer History)
  const getTierBadgeStyle = (tierCode = '', tierName = '') => {
    const code = (tierCode || tierName).toUpperCase();
    if (code.includes('5') || code.includes('DIAMOND')) {
      return { bg: '#fae8ff', text: '#86198f', border: '#f0abfc', badge: '#a21caf' };
    }
    if (code.includes('4') || code.includes('PLATINUM')) {
      return { bg: '#f1f5f9', text: '#1e293b', border: '#cbd5e1', badge: '#475569' };
    }
    if (code.includes('3') || code.includes('GOLD')) {
      return { bg: '#fef3c7', text: '#92400e', border: '#fde68a', badge: '#b45309' };
    }
    if (code.includes('2') || code.includes('SILVER')) {
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', badge: '#0284c7' };
    }
    if (code.includes('1') || code.includes('BRONZE')) {
      return { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa', badge: '#ea580c' };
    }
    return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', badge: '#64748b' };
  };

  return (
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
      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER (2 EQUAL HALVES: Left = Period Selector & Range Info, Right = KPI Metrics Card)
         ───────────────────────────────────────────────────────────── */}
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
        {/* LEFT HALF (50% of window): Period selector on top, Range detail strip on bottom */}
        <div
          style={{
            flex: '1 1 360px',
            width: 'calc(50% - 6px)',
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Period Selector Line */}
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
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} color="#64748b" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155' }}>
                Calculation Period:
              </span>
              <input className="erp-field"
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setDashPage(0);
                }}
                style={{
                  height: '26px',
                  padding: '0 6px',
                  border: '1px solid #cbd5e1',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 'var(--erp-text-caption)',
                fontWeight: 600,
                color: '#0284c7',
                backgroundColor: '#e0f2fe',
                padding: '2px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {dashboardData?.monthLabel || selectedMonth}
            </span>
          </div>

          {/* Range Info Strip (Same width as Period line = half the window) */}
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
              fontSize: 'var(--erp-text-body)',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--erp-text-caption)',
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
                RANGE & TARGETS
              </span>
              <span
                style={{
                  fontSize: 'var(--erp-text-badge)',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Active
              </span>
              <span
                style={{
                  color: '#475569',
                  fontSize: 'var(--erp-text-small)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                Spend milestones & POS progression
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 'var(--erp-text-caption)',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} color="#0284c7" /> Auto-syncs POS
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT HALF (50% of window): Card with 4 equal columns matching left side height */}
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
            gridTemplateColumns: 'repeat(4, 1fr)',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          {/* Column 1: Total Active Customers */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 6px',
              borderRight: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: 'var(--erp-text-badge)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Customers
            </span>
            <span style={{ fontSize: 'var(--erp-text-nav)', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
              {dashboardData?.totalActiveCustomers ?? 0}
            </span>
          </div>

          {/* Column 2: Active Purchasers */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 6px',
              borderRight: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: 'var(--erp-text-badge)', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Purchasers
            </span>
            <span style={{ fontSize: 'var(--erp-text-nav)', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
              {dashboardData?.customersWithPurchases ?? 0}
            </span>
          </div>

          {/* Column 3: Promoted Customers */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 6px',
              borderRight: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: 'var(--erp-text-badge)', fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Promoted (1+)
            </span>
            <span style={{ fontSize: 'var(--erp-text-nav)', fontWeight: 700, color: '#d97706', fontFamily: 'monospace' }}>
              {dashboardData?.promotedCustomersCount ?? 0}
            </span>
          </div>

          {/* Column 4: Monthly Qualifying Sales */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 6px',
            }}
          >
            <span style={{ fontSize: 'var(--erp-text-badge)', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Qualifying Sales
            </span>
            <span style={{ fontSize: 'var(--erp-text-nav)', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
              LKR {Number(dashboardData?.totalMonthlyQualifyingSales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          UNIFIED SUB-NAV TABS & TABLE TOOLBAR (Single-line, matching Customer History)
         ───────────────────────────────────────────────────────────── */}
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
            { id: 'dashboard', label: 'Customer Ranges', count: dashboardData?.totalElements ?? dashboardData?.totalActiveCustomers },
            { id: 'setup', label: 'Range Tiers Setup', count: ranges.length },
            { id: 'reports', label: 'Staff Performance', count: staffPerformance.length },
            { id: 'campaigns', label: 'Promotional Targets' },
          ].map((tab) => {
            const isSel = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                style={{
                  backgroundColor: isSel ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '4px 8px',
                  fontSize: 'var(--erp-text-small)',
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
                {tab.count !== undefined && tab.count !== null && (
                  <span
                    style={{
                      fontSize: 'var(--erp-text-badge)',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '9999px',
                      backgroundColor: isSel ? '#e0f2fe' : '#e2e8f0',
                      color: isSel ? '#0284c7' : '#64748b',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toolbar Controls per active sub-tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {subTab === 'dashboard' && (
            <>
              {/* Search Customer Input */}
              <div style={{ position: 'relative', width: '200px', minWidth: '150px' }}>
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
                <input className="erp-field"
                  type="text"
                  placeholder="Search customer..."
                  value={dashSearch}
                  onChange={(e) => {
                    setDashSearch(e.target.value);
                    setDashPage(0);
                  }}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 24px 0 26px',
                    border: '1px solid #e2e8f0',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                />
                {dashSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDashSearch('');
                      setDashPage(0);
                    }}
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

              {/* Range Filter */}
              <select className="erp-field"
                value={dashRangeFilter}
                onChange={(e) => {
                  setDashRangeFilter(e.target.value);
                  setDashPage(0);
                }}
                style={{
                  height: '32px',
                  padding: '0 24px 0 8px',
                  width: '120px',
                  border: '1px solid #e2e8f0',
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
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              >
                <option value="ALL">All Ranges</option>
                {(dashboardData?.configuredRanges || ranges || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Staff Filter */}
              <select className="erp-field"
                value={dashStaffFilter}
                onChange={(e) => {
                  setDashStaffFilter(e.target.value);
                  setDashPage(0);
                }}
                style={{
                  height: '32px',
                  padding: '0 24px 0 8px',
                  width: '130px',
                  border: '1px solid #e2e8f0',
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
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              >
                <option value="ALL">All Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username}
                  </option>
                ))}
              </select>

              {/* Near Target Toggle */}
              <button
                type="button"
                onClick={() => setDashNearTargetOnly(!dashNearTargetOnly)}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: dashNearTargetOnly ? '1px solid #0284c7' : '1px solid #e2e8f0',
                  backgroundColor: dashNearTargetOnly ? '#e0f2fe' : '#ffffff',
                  color: dashNearTargetOnly ? '#0284c7' : '#64748b',
                  fontSize: 'var(--erp-text-small)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
                title="Filter customers close to next range threshold"
              >
                <Sparkles size={12} color={dashNearTargetOnly ? '#0284c7' : '#94a3b8'} />
                <span>Near Target ({dashboardData?.customersCloseToTargetCount ?? 0})</span>
              </button>

              {/* Reset Button */}
              {(dashSearch || dashRangeFilter !== 'ALL' || dashStaffFilter !== 'ALL' || dashNearTargetOnly) && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setDashSearch('');
                    setDashRangeFilter('ALL');
                    setDashStaffFilter('ALL');
                    setDashNearTargetOnly(false);
                    setDashPage(0);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    whiteSpace: 'nowrap',
                  }}
                  title="Reset filters"
                >
                  <X size={12} /> Reset
                </button>
              )}

              {/* Export CSV (Icon Only) */}
              <button
                type="button"
                onClick={handleExportDashboardCSV}
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
                }}
                title="Export Range Report to CSV"
              >
                <Download size={13} />
              </button>

              {/* Sync / Refresh Month (Icon Only) */}
              <button
                type="button"
                onClick={canEdit?handleSyncMonth:loadDashboard}
                disabled={loadingDashboard || syncingMonth}
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
                }}
                title={canEdit?"Synchronize & Recalculate Month":"Refresh customer ranges"}
              >
                <RefreshCw size={13} className={loadingDashboard ? 'spin' : ''} />
              </button>
            </>
          )}

          {subTab === 'setup' && (
            <>
              {/* Audit Trail Button */}
              <button className="erp-button"
                type="button"
                onClick={loadAuditLogs}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <ShieldCheck size={13} color="#0284c7" /> Audit Trail
              </button>

              {/* Refresh Ranges (Icon Only) */}
              <button
                type="button"
                onClick={loadRanges}
                disabled={loadingRanges}
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
                }}
                title="Refresh Ranges"
              >
                <RefreshCw size={13} className={loadingRanges ? 'spin' : ''} />
              </button>

              {/* New Range Tier Button */}
              {canEdit && (
                <button className="erp-button erp-button-primary"
                  type="button"
                  onClick={handleOpenCreateRange}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={14} /> New Range Tier
                </button>
              )}
            </>
          )}

          {subTab === 'reports' && (
            <>
              {/* Export Staff CSV */}
              <button className="erp-button"
                type="button"
                onClick={handleExportStaffCSV}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Download size={13} /> Export CSV
              </button>

              {/* Print Report */}
              <button className="erp-button"
                type="button"
                onClick={() => window.print()}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Printer size={13} /> Print Report
              </button>

              {/* Refresh Reports (Icon Only) */}
              <button
                type="button"
                onClick={() => {
                  loadReports();
                  loadDashboard();
                }}
                disabled={loadingReports}
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
                }}
                title="Refresh Report Data"
              >
                <RefreshCw size={13} className={loadingReports ? 'spin' : ''} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 1: CUSTOMER RANGES TABLE (SCREEN C)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading">CUSTOMER</th>
                    <th className="erp-table-heading">ASSIGNED STAFF</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right' }}>MONTH PURCHASES</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>CURRENT RANGE</th>
                    <th className="erp-table-heading">PROGRESS TO NEXT TARGET</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right' }}>REMAINING</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDashboard ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#0284c7' }} />
                        Loading customer monthly ranges...
                      </td>
                    </tr>
                  ) : dashboardError ? (
                    <tr><td colSpan={7}><div role="alert" style={{padding:'24px',textAlign:'center'}}><p>{dashboardError}</p><button type="button" className="btn btn-glass erp-button" onClick={loadDashboard}>Retry loading customer ranges</button></div></td></tr>
                  ) : displayedCustomers.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <Search size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                        No customers found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayedCustomers.map((c) => {
                      const tierStyle = getTierBadgeStyle(c.currentRangeCode, c.currentRangeName);
                      const purchases = Number(c.monthlyPurchases || 0);
                      const remaining = Number(c.remainingAmount || 0);
                      const nextTarget = Number(c.nextTargetAmount || 0);
                      const pct = Number(c.progressPercentage || 0);

                      return (
                        <tr
                          key={c.customerId}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {/* Customer Name & Code */}
                          <td className="erp-table-cell">
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 'var(--erp-text-button)' }}>
                              {c.customerName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="erp-table-code"
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 'var(--erp-text-caption)',
                                  fontWeight: 700,
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                {c.customerCode || 'NO CODE'}
                              </span>
                              {c.customerPhone && (
                                <span style={{ fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
                                  📞 {c.customerPhone}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Assigned Staff */}
                          <td className="erp-table-cell erp-table-actions">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: 'var(--erp-text-body)',
                                  fontWeight: 500,
                                  color: c.assignedStaffName && c.assignedStaffName !== 'Unassigned' ? '#334155' : '#94a3b8',
                                }}
                              >
                                {c.assignedStaffName || 'Unassigned'}
                              </span>
                              {canEdit && (
                                <button aria-label="Change assigned staff" className="erp-table-icon-action"
                                  type="button"
                                  onClick={() => handleOpenAssignStaff(c)}
                                  title="Change assigned staff"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    color: '#0284c7',
                                    display: 'inline-flex',
                                  }}
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Month Net Purchases */}
                          <td className="erp-table-cell" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: purchases > 0 ? '#0f172a' : '#94a3b8' }}>
                            LKR {purchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Current Range Badge */}
                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: 'var(--erp-text-caption)',
                                fontWeight: 600,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                border: `1px solid ${tierStyle.border}`,
                              }}
                            >
                              <Award size={11} color={tierStyle.badge} />
                              {c.currentRangeName}
                            </span>
                          </td>

                          {/* Progress to Next Target */}
                          <td className="erp-table-cell" style={{ minWidth: '170px' }}>
                            {c.isHighestRange ? (
                              <div style={{ fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#86198f', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                🏆 Highest Range Tier
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--erp-text-caption)', marginBottom: '3px' }}>
                                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                                    Next: <strong style={{ color: '#334155' }}>{c.nextRangeName}</strong>
                                  </span>
                                  <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                                    {pct}%
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: '6px',
                                    width: '100%',
                                    background: '#f1f5f9',
                                    borderRadius: '9999px',
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(0, pct))}%`,
                                      background: '#0284c7',
                                      borderRadius: '9999px',
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: 'var(--erp-text-badge)', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                                  Target: LKR {nextTarget.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Remaining Amount */}
                          <td className="erp-table-cell" style={{ textAlign: 'right' }}>
                            {c.isHighestRange ? (
                              <span style={{ fontSize: 'var(--erp-text-caption)', color: '#94a3b8' }}>—</span>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 'var(--erp-text-field)', fontFamily: 'monospace' }}>
                                  LKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {c.isCloseToTarget && (
                                  <span
                                    style={{
                                      fontSize: 'var(--erp-text-badge)',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      borderRadius: '9999px',
                                      background: '#e0f2fe',
                                      color: '#0284c7',
                                      border: '1px solid #bae6fd',
                                      display: 'inline-block',
                                      marginTop: '2px',
                                    }}
                                  >
                                    ⚡ Near Target
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions: View History */}
                          <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center' }}>
                            <button aria-label="View monthly range progression history" className="erp-button erp-table-icon-action"
                              type="button"
                              onClick={() => handleViewCustomerHistory(c)}
                              style={{
                                height: '28px',
                                padding: '0 8px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                              }}
                              title="View monthly range progression history"
                            ><Clock size={12} color="#0284c7" /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {dashboardData?.totalPages > 1 && (
              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fafbfc',
                  fontSize: 'var(--erp-text-small)',
                }}
              >
                <div style={{ color: '#64748b' }}>
                  Showing {dashPage * dashPageSize + 1} to{' '}
                  {Math.min((dashPage + 1) * dashPageSize, dashboardData.totalElements)} of{' '}
                  {dashboardData.totalElements} customers
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button className="erp-button"
                    type="button"
                    disabled={dashPage === 0}
                    onClick={() => setDashPage(dashPage - 1)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      color: dashPage === 0 ? '#94a3b8' : '#334155',
                      cursor: dashPage === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '0 6px', fontWeight: 600, color: '#334155', fontSize: 'var(--erp-text-small)' }}>
                    {dashPage + 1} / {dashboardData.totalPages}
                  </span>
                  <button className="erp-button"
                    type="button"
                    disabled={dashPage >= dashboardData.totalPages - 1}
                    onClick={() => setDashPage(dashPage + 1)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      color: dashPage >= dashboardData.totalPages - 1 ? '#94a3b8' : '#334155',
                      cursor: dashPage >= dashboardData.totalPages - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 2: RANGE SETUP & CONFIGURATION (SCREEN A)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ width: '60px', textAlign: 'center' }}>ORDER</th>
                    <th className="erp-table-heading">RANGE CODE</th>
                    <th className="erp-table-heading">NAME</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right' }}>MONTHLY THRESHOLD</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>STATUS</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>CUSTOMERS (THIS MONTH)</th>
                    <th className="erp-table-heading">DESCRIPTION</th>
                    {canEdit && <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center' }}>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingRanges ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#0284c7' }} />
                        Loading range definitions...
                      </td>
                    </tr>
                  ) : ranges.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <Sliders size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                        No range tiers defined yet. Click "New Range Tier" above to create one.
                      </td>
                    </tr>
                  ) : (
                    ranges.map((r) => {
                      const tierStyle = getTierBadgeStyle(r.rangeCode, r.name);
                      const isBaseline = r.rangeCode === 'RANGE_0' || r.displayOrder === 0;

                      return (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            opacity: r.isActive ? 1 : 0.6,
                            transition: 'background-color 0.12s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {/* Display Order */}
                          <td className="erp-table-cell" style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                            #{r.displayOrder}
                          </td>

                          {/* Range Code */}
                          <td className="erp-table-cell erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                            {r.rangeCode}
                          </td>

                          {/* Range Name */}
                          <td className="erp-table-cell">
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: 'var(--erp-text-caption)',
                                fontWeight: 600,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                border: `1px solid ${tierStyle.border}`,
                              }}
                            >
                              <Award size={12} color={tierStyle.badge} />
                              {r.name}
                            </span>
                          </td>

                          {/* Monthly Spend Threshold */}
                          <td className="erp-table-cell" style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-button)', color: '#0f172a', fontFamily: 'monospace' }}>
                              LKR {Number(r.minSpend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: 'var(--erp-text-badge)', color: '#64748b' }}>
                              {isBaseline ? 'Base threshold' : 'Qualifying spend'}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} />
                          </td>

                          {/* Customer Count */}
                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                fontWeight: 600,
                                fontSize: 'var(--erp-text-caption)',
                                color: '#334155',
                                fontFamily: 'monospace',
                              }}
                            >
                              {r.currentMonthCustomerCount ?? 0} customers
                            </span>
                          </td>

                          {/* Description */}
                          <td className="erp-table-cell" style={{ color: '#64748b', maxWidth: '240px' }}>
                            {r.description || '—'}
                          </td>

                          {/* Action Buttons */}
                          {canEdit && (
                            <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button aria-label="Edit range details" className="erp-button erp-table-icon-action"
                                  type="button"
                                  onClick={() => handleOpenEditRange(r)}
                                  style={{
                                    height: '28px',
                                    padding: '0 8px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#ffffff',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title="Edit range details"
                                ><Edit2 size={11} /></button>

                                {!isBaseline && (
                                  <button className="erp-table-icon-action" data-tone={r.isActive ? 'danger' : undefined}
                                    aria-label={r.isActive ? 'Deactivate range' : 'Activate range'}
                                    title={r.isActive ? 'Deactivate range' : 'Activate range'}
                                    type="button"
                                    onClick={() => handleToggleRangeStatus(r)}
                                    style={{
                                      height: '28px',
                                      padding: '0 8px',
                                      borderRadius: '5px',
                                      border: '1px solid',
                                      borderColor: r.isActive ? '#fecaca' : '#bbf7d0',
                                      background: r.isActive ? '#fee2e2' : '#dcfce7',
                                      color: r.isActive ? '#b91c1c' : '#15803d',
                                      fontSize: 'var(--erp-text-caption)',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {r.isActive ? <X size={13}/> : <Check size={13}/>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
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

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 3: MONTHLY REPORTS & STAFF PERFORMANCE (SCREEN D)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0 }}>
          {/* Customer Range Distribution Cards Strip */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '12px 16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div style={{ fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
              Customer Range Distribution ({dashboardData?.monthLabel || selectedMonth})
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '8px',
              }}
            >
              {Object.entries(dashboardData?.rangeCustomerCounts || {}).map(([rangeName, count]) => {
                const total = dashboardData?.totalActiveCustomers || 1;
                const percentage = ((count / total) * 100).toFixed(1);
                const tierStyle = getTierBadgeStyle(rangeName, rangeName);

                return (
                  <div
                    key={rangeName}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: tierStyle.bg,
                      border: `1px solid ${tierStyle.border}`,
                    }}
                  >
                    <div style={{ fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: tierStyle.text }}>
                      {rangeName}
                    </div>
                    <div style={{ fontSize: 'var(--erp-text-section)', fontWeight: 700, color: tierStyle.text, fontFamily: 'monospace', marginTop: '2px' }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 'var(--erp-text-badge)', color: tierStyle.text, opacity: 0.85, marginTop: '1px' }}>
                      {percentage}% of customers
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff Member Target Achievements Table */}
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading">STAFF MEMBER</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>ASSIGNED CUSTOMERS</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>ACTIVE PURCHASERS</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>PROMOTED (RANGE 1+)</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right' }}>TOTAL QUALIFYING SALES</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center' }}>CONVERSION RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingReports ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#0284c7' }} />
                        Loading staff performance data...
                      </td>
                    </tr>
                  ) : staffPerformance.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                        No staff assignments found for this month. Assign customers to sales representatives in the Customer Ranges tab.
                      </td>
                    </tr>
                  ) : (
                    staffPerformance.map((p) => {
                      const totalAssigned = p.totalAssignedCustomers || 0;
                      const active = p.activePurchasingCustomers || 0;
                      const promoted = p.promotedCustomers || 0;
                      const conversion = totalAssigned > 0 ? ((promoted / totalAssigned) * 100).toFixed(1) : 0;
                      const totalSales = Number(p.totalQualifyingPurchases || 0);

                      return (
                        <tr
                          key={p.staffId}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td className="erp-table-cell">
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 'var(--erp-text-button)' }}>{p.staffName}</div>
                            <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', fontFamily: 'monospace' }}>@{p.staffUsername}</div>
                          </td>

                          <td className="erp-table-cell" style={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                            {totalAssigned}
                          </td>

                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#16a34a', fontFamily: 'monospace', fontSize: 'var(--erp-text-field)' }}>{active}</span>
                            <span style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}> ({totalAssigned > 0 ? Math.round((active / totalAssigned) * 100) : 0}%)</span>
                          </td>

                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: promoted > 0 ? '#fef3c7' : '#f1f5f9',
                                color: promoted > 0 ? '#b45309' : '#64748b',
                                border: promoted > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                fontWeight: 600,
                                fontSize: 'var(--erp-text-caption)',
                              }}
                            >
                              {promoted} customers
                            </span>
                          </td>

                          <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 600, color: '#0284c7', fontFamily: 'monospace' }}>
                            LKR {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, color: Number(conversion) >= 50 ? '#16a34a' : '#334155', fontFamily: 'monospace', fontSize: 'var(--erp-text-field)' }}>
                              {conversion}%
                            </div>
                            <div style={{ height: '4px', width: '64px', background: '#e2e8f0', borderRadius: '9999px', margin: '3px auto 0', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(0, conversion))}%`,
                                  background: Number(conversion) >= 50 ? '#16a34a' : '#0284c7',
                                  borderRadius: '9999px',
                                }}
                              />
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

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 4: PROMOTIONAL TARGETS (V5 CAMPAIGNS)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'campaigns' && (
        <CustomerTargetsTab
          customers={customers}
          salesmen={staffList}
          routes={routes}
          canEdit={canEdit}
          addToast={addToast}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE / EDIT RANGE TIER (SCREEN A)
         ───────────────────────────────────────────────────────────── */}
      {showRangeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setShowRangeModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '500px',
              width: '100%',
              padding: '20px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                  {editingRange ? 'Edit Range Tier' : 'New Range Tier'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRangeModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Range Code *
                </label>
                <input className="erp-field"
                  type="text"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    border: '1px solid #cbd5e1',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                    backgroundColor: editingRange ? '#f8fafc' : '#ffffff',
                  }}
                  disabled={!!editingRange}
                  value={rangeForm.rangeCode}
                  onChange={(e) => setRangeForm({ ...rangeForm, rangeCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Range Display Name * (e.g. Range 1, Bronze, Silver)
                </label>
                <input className="erp-field"
                  type="text"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                  value={rangeForm.name}
                  onChange={(e) => setRangeForm({ ...rangeForm, name: e.target.value })}
                  placeholder="e.g. Range 1"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Monthly Purchase Threshold (LKR) *
                </label>
                <input className="erp-field"
                  type="number"
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    backgroundColor: editingRange && editingRange.rangeCode === 'RANGE_0' ? '#f8fafc' : '#ffffff',
                  }}
                  value={rangeForm.minSpend}
                  disabled={editingRange && editingRange.rangeCode === 'RANGE_0'}
                  onChange={(e) => setRangeForm({ ...rangeForm, minSpend: e.target.value })}
                  placeholder="e.g. 50000"
                  required
                />
                {editingRange && editingRange.rangeCode === 'RANGE_0' && (
                  <span style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Range 0 is the starting base tier and must always remain at LKR 0.00.
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Display Order
                  </label>
                  <input className="erp-field"
                    type="number"
                    min="0"
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                    }}
                    value={rangeForm.displayOrder}
                    onChange={(e) => setRangeForm({ ...rangeForm, displayOrder: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Active Status
                  </label>
                  <select className="erp-field"
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      border: '1px solid #cbd5e1',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                    }}
                    value={rangeForm.isActive ? 'true' : 'false'}
                    disabled={editingRange && editingRange.rangeCode === 'RANGE_0'}
                    onChange={(e) => setRangeForm({ ...rangeForm, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Description (Optional)
                </label>
                <textarea className="erp-field"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    resize: 'none',
                  }}
                  value={rangeForm.description}
                  onChange={(e) => setRangeForm({ ...rangeForm, description: e.target.value })}
                  placeholder="Notes about this customer range milestone..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button className="erp-button"
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  disabled={savingRange}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRange}
                  style={{
                    height: '32px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: 'var(--erp-text-small)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {savingRange ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
                  {editingRange ? 'Update Range' : 'Save Range'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: AUDIT TRAIL LOGS (SCREEN A)
         ───────────────────────────────────────────────────────────── */}
      {showAuditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setShowAuditModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '640px',
              width: '100%',
              padding: '20px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                  Range Configuration Audit Trail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
              Maintains an immutable record of changes to ranges, threshold edits, and tier promotions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 'var(--erp-text-field)' }}>
                  No audit logs recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 'var(--erp-text-body)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 'var(--erp-text-caption)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: log.actionType?.includes('CREATE') ? '#dcfce7' : '#e0f2fe',
                          color: log.actionType?.includes('CREATE') ? '#15803d' : '#0284c7',
                        }}
                      >
                        {log.actionType}
                      </span>
                      <span style={{ fontSize: 'var(--erp-text-caption)', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {new Date(log.performedAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{log.details}</div>
                    <div style={{ fontSize: 'var(--erp-text-badge)', color: '#64748b', marginTop: '3px' }}>
                      By: <strong>{log.performedBy || 'SYSTEM'}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CUSTOMER MONTHLY RANGE HISTORY (SCREEN C)
         ───────────────────────────────────────────────────────────── */}
      {historyCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setHistoryCustomer(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '600px',
              width: '100%',
              padding: '20px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#0284c7" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                    Monthly Range History
                  </h3>
                  <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                    {historyCustomer.customerName} ({historyCustomer.customerCode})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
              Historical record of qualifying purchases and achieved range milestones across past calculation cycles.
            </p>

            {loadingHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block', color: '#0284c7' }} />
                Loading history...
              </div>
            ) : customerHistory.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: 'var(--erp-text-field)' }}>
                No past monthly range records found for this customer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customerHistory.map((h) => {
                  const tierStyle = getTierBadgeStyle(h.finalRangeCode, h.finalRangeName);
                  return (
                    <div
                      key={h.yearMonth}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--erp-text-field)', color: '#0f172a' }}>
                          {h.monthLabel || h.yearMonth}
                        </div>
                        <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                          Invoices: {h.invoiceCount || 0} • Last Purchase: {h.lastPurchaseDate || 'None'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-button)', color: '#0f172a', fontFamily: 'monospace' }}>
                          LKR {Number(h.qualifyingPurchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            fontSize: 'var(--erp-text-badge)',
                            fontWeight: 600,
                            background: tierStyle.bg,
                            color: tierStyle.text,
                            border: `1px solid ${tierStyle.border}`,
                            marginTop: '2px',
                          }}
                        >
                          <Award size={10} color={tierStyle.badge} />
                          {h.finalRangeName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ASSIGN STAFF TO CUSTOMER (SCREEN C - RT-11)
         ───────────────────────────────────────────────────────────── */}
      {assigningCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setAssigningCustomer(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '420px',
              width: '100%',
              padding: '20px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                  Assign Customer to Staff
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssigningCustomer(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--erp-text-button)', color: '#0f172a' }}>
                {assigningCustomer.customerName}
              </div>
              <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', marginTop: '2px' }}>
                Code: <span style={{ fontFamily: 'monospace' }}>{assigningCustomer.customerCode}</span> • Current: {assigningCustomer.assignedStaffName || 'Unassigned'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Sales Representative:
              </label>
              <select className="erp-field"
                style={{
                  width: '100%',
                  height: '35px',
                  padding: '0 10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
                value={selectedNewStaffId}
                onChange={(e) => setSelectedNewStaffId(e.target.value)}
              >
                <option value="">Unassigned (No staff)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username} ({s.username})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="erp-button"
                type="button"
                onClick={() => setAssigningCustomer(null)}
                disabled={savingAssignStaff}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button className="erp-button erp-button-primary"
                type="button"
                onClick={handleSaveAssignStaff}
                disabled={savingAssignStaff}
                style={{
                  height: '32px',
                  padding: '0 16px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {savingAssignStaff ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
