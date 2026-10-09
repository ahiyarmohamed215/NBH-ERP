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
  const [dashSearch, setDashSearch] = useState('');
  const [dashRangeFilter, setDashRangeFilter] = useState('ALL');
  const [dashStaffFilter, setDashStaffFilter] = useState('ALL');
  const [dashNearTargetOnly, setDashNearTargetOnly] = useState(false);
  const [dashPage, setDashPage] = useState(0);
  const [dashPageSize, setDashPageSize] = useState(25);

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
      if (addToast) addToast('Failed to load customer range dashboard', 'error');
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

  // Listen to ERP event bus updates (invoices finalized, targets changed)
  useEffect(() => {
    const handleSync = () => {
      if (subTab === 'dashboard') loadDashboard();
      if (subTab === 'setup') loadRanges();
      if (subTab === 'reports') loadReports();
    };
    window.addEventListener('erp:sales_updated', handleSync);
    window.addEventListener('erp:targets_updated', handleSync);
    return () => {
      window.removeEventListener('erp:sales_updated', handleSync);
      window.removeEventListener('erp:targets_updated', handleSync);
    };
  }, [subTab, loadDashboard, loadRanges, loadReports]);

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
    try {
      await customerMonthlyRangeApi.syncMonth(selectedMonth);
      if (addToast) addToast(`Month ${selectedMonth} ranges synchronized!`, 'success');
      loadDashboard();
    } catch (err) {
      if (addToast) addToast('Failed to synchronize monthly ranges', 'error');
    }
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

  // Tier color styling helper
  const getTierBadgeStyle = (tierCode = '', tierName = '') => {
    const code = (tierCode || tierName).toUpperCase();
    if (code.includes('5') || code.includes('DIAMOND')) {
      return { bg: 'linear-gradient(135deg, #ede9fe 0%, #f5d0fe 100%)', text: '#701a75', border: '#d946ef', badge: '#a21caf' };
    }
    if (code.includes('4') || code.includes('PLATINUM')) {
      return { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', text: '#1e293b', border: '#94a3b8', badge: '#475569' };
    }
    if (code.includes('3') || code.includes('GOLD')) {
      return { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#854d0e', border: '#f59e0b', badge: '#b45309' };
    }
    if (code.includes('2') || code.includes('SILVER')) {
      return { bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', text: '#0369a1', border: '#38bdf8', badge: '#0284c7' };
    }
    if (code.includes('1') || code.includes('BRONZE')) {
      return { bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)', text: '#9a3412', border: '#fb923c', badge: '#ea580c' };
    }
    return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', badge: '#64748b' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER & SUB-TAB NAVIGATION
         ───────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Target size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Customer Range & Targets Management
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Monthly spend milestones, POS auto-progression, staff tracking, and range tier configuration
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Pills */}
        <div
          style={{
            display: 'inline-flex',
            padding: '4px',
            borderRadius: '10px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setSubTab('dashboard')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: subTab === 'dashboard' ? '#ffffff' : 'transparent',
              color: subTab === 'dashboard' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'dashboard' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <TrendingUp size={15} /> Customer Dashboard
          </button>

          <button
            type="button"
            onClick={() => setSubTab('setup')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: subTab === 'setup' ? '#ffffff' : 'transparent',
              color: subTab === 'setup' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'setup' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <Sliders size={15} /> Range Setup
          </button>

          <button
            type="button"
            onClick={() => setSubTab('reports')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: subTab === 'reports' ? '#ffffff' : 'transparent',
              color: subTab === 'reports' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'reports' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <Award size={15} /> Monthly Reports
          </button>

          <button
            type="button"
            onClick={() => setSubTab('campaigns')}
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: subTab === 'campaigns' ? '#ffffff' : 'transparent',
              color: subTab === 'campaigns' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'campaigns' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <Sparkles size={15} /> Promotional Campaigns
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: SCREEN C — CUSTOMER RANGE DASHBOARD
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Month Selector & Quick Actions */}
          <div
            className="glass-card"
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>Calculation Period:</span>
              </div>
              <input
                type="month"
                className="input-glass"
                style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, width: '170px' }}
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setDashPage(0);
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                {dashboardData?.monthLabel || selectedMonth}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSyncMonth}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 12px' }}
                title="Synchronize/Recalculate customer qualifying purchases for this month"
              >
                <RefreshCw size={14} className={loadingDashboard ? 'spin' : ''} />
                Sync Month
              </button>

              <button
                type="button"
                onClick={handleExportDashboardCSV}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 12px' }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            <div className="glass-card" style={{ padding: '14px 18px', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>TOTAL ACTIVE CUSTOMERS</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {dashboardData?.totalActiveCustomers ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Registered Customers</div>
            </div>

            <div className="glass-card" style={{ padding: '14px 18px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>ACTIVE PURCHASERS</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                {dashboardData?.customersWithPurchases ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Bought this month</div>
            </div>

            <div className="glass-card" style={{ padding: '14px 18px', borderLeft: '4px solid #eab308' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>PROMOTED (RANGE 1+)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ca8a04', marginTop: '4px' }}>
                {dashboardData?.promotedCustomersCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Exceeded starting tier</div>
            </div>

            <div className="glass-card" style={{ padding: '14px 18px', borderLeft: '4px solid #06b6d4' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>NEAR NEXT TARGET</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0891b2', marginTop: '4px' }}>
                {dashboardData?.customersCloseToTargetCount ?? 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>≥ 75% to next range</div>
            </div>

            <div className="glass-card" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>MONTHLY QUALIFYING SALES</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                Rs. {Number(dashboardData?.totalMonthlyQualifyingSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Net of returns & refunds</div>
            </div>
          </div>

          {/* Search & Filtering Controls */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Search Bar */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '36px', width: '100%', height: '36px', fontSize: '0.85rem' }}
                placeholder="Search by customer name, code, phone..."
                value={dashSearch}
                onChange={(e) => {
                  setDashSearch(e.target.value);
                  setDashPage(0);
                }}
              />
            </div>

            {/* Filter by Range */}
            <div style={{ minWidth: '160px' }}>
              <select
                className="input-glass"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                value={dashRangeFilter}
                onChange={(e) => {
                  setDashRangeFilter(e.target.value);
                  setDashPage(0);
                }}
              >
                <option value="ALL">All Ranges</option>
                {(dashboardData?.configuredRanges || ranges || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (≥ Rs. {Number(r.minSpend).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Staff */}
            <div style={{ minWidth: '170px' }}>
              <select
                className="input-glass"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                value={dashStaffFilter}
                onChange={(e) => {
                  setDashStaffFilter(e.target.value);
                  setDashPage(0);
                }}
              >
                <option value="ALL">All Assigned Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Near Target Toggle */}
            <button
              type="button"
              onClick={() => setDashNearTargetOnly(!dashNearTargetOnly)}
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: dashNearTargetOnly ? '1px solid #0891b2' : '1px solid #cbd5e1',
                background: dashNearTargetOnly ? '#ecfeff' : '#ffffff',
                color: dashNearTargetOnly ? '#0e7490' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
              }}
            >
              <Sparkles size={14} color={dashNearTargetOnly ? '#0891b2' : '#94a3b8'} />
              Near Next Target ({dashboardData?.customersCloseToTargetCount ?? 0})
            </button>
          </div>

          {/* Customer Range Table */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem' }}>
                    <th style={{ padding: '12px 16px' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 14px' }}>ASSIGNED STAFF</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>MONTH PURCHASES</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>CURRENT RANGE</th>
                    <th style={{ padding: '12px 14px' }}>PROGRESS TO NEXT TARGET</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>REMAINING</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDashboard ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                        Loading customer ranges...
                      </td>
                    </tr>
                  ) : displayedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
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
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {/* Customer Name & Code */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.customerName}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.customerCode}</span>
                              {c.customerPhone && <span>• {c.customerPhone}</span>}
                            </div>
                          </td>

                          {/* Assigned Staff */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: c.assignedStaffName && c.assignedStaffName !== 'Unassigned' ? '#1e293b' : '#94a3b8',
                                }}
                              >
                                {c.assignedStaffName || 'Unassigned'}
                              </span>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignStaff(c)}
                                  title="Change assigned staff"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    color: '#2563eb',
                                  }}
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Month Net Purchases */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: purchases > 0 ? '#0f172a' : '#94a3b8', fontSize: '0.9rem' }}>
                              Rs. {purchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Current Range Badge */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                border: `1px solid ${tierStyle.border}`,
                              }}
                            >
                              <Award size={12} color={tierStyle.badge} />
                              {c.currentRangeName}
                            </span>
                          </td>

                          {/* Progress to Next Target */}
                          <td style={{ padding: '12px 14px', minWidth: '180px' }}>
                            {c.isHighestRange ? (
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#701a75' }}>
                                🏆 Highest Range Achieved!
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                                  <span style={{ color: '#475569', fontWeight: 600 }}>
                                    Next: <strong>{c.nextRangeName}</strong>
                                  </span>
                                  <span style={{ fontWeight: 700, color: pct >= 75 ? '#0891b2' : '#2563eb' }}>
                                    {pct}%
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: '6px',
                                    width: '100%',
                                    background: '#e2e8f0',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(0, pct))}%`,
                                      background:
                                        pct >= 75
                                          ? 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)'
                                          : 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
                                      borderRadius: '4px',
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                  Target: Rs. {nextTarget.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Remaining Amount */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            {c.isHighestRange ? (
                              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>—</span>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                                  Rs. {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {c.isCloseToTarget && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: '#ecfeff',
                                      color: '#0891b2',
                                      border: '1px solid #a5f3fc',
                                      display: 'inline-block',
                                      marginTop: '2px',
                                    }}
                                  >
                                    ⚡ Close to target!
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions: View History */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleViewCustomerHistory(c)}
                              className="btn-secondary"
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Clock size={12} /> History
                            </button>
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
                  padding: '12px 20px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ color: '#64748b' }}>
                  Showing {dashPage * dashPageSize + 1} to{' '}
                  {Math.min((dashPage + 1) * dashPageSize, dashboardData.totalElements)} of{' '}
                  {dashboardData.totalElements} customers
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={dashPage === 0}
                    onClick={() => setDashPage(dashPage - 1)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '4px 8px', fontWeight: 700, color: '#334155' }}>
                    {dashPage + 1} / {dashboardData.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={dashPage >= dashboardData.totalPages - 1}
                    onClick={() => setDashPage(dashPage + 1)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
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
          TAB 2: SCREEN A — RANGE SETUP & CONFIGURATION (ADMIN)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            className="glass-card"
            style={{
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Customer Purchase Range Tiers Setup
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Configure monthly qualifying spend thresholds and tier order. Duplicate thresholds are prevented.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={loadAuditLogs}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <ShieldCheck size={15} /> Audit Trail
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenCreateRange}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  <Plus size={16} /> New Range Tier
                </button>
              )}
            </div>
          </div>

          {/* Configured Ranges List */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem' }}>
                    <th style={{ padding: '12px 16px', width: '70px', textAlign: 'center' }}>ORDER</th>
                    <th style={{ padding: '12px 16px' }}>RANGE CODE</th>
                    <th style={{ padding: '12px 16px' }}>NAME</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>MONTHLY THRESHOLD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIVE CUSTOMERS (THIS MONTH)</th>
                    <th style={{ padding: '12px 16px' }}>DESCRIPTION</th>
                    {canEdit && <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingRanges ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                        Loading range definitions...
                      </td>
                    </tr>
                  ) : ranges.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No ranges defined yet. Click "New Range Tier" to create one.
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
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {/* Display Order */}
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                            #{r.displayOrder}
                          </td>

                          {/* Range Code */}
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                            {r.rangeCode}
                          </td>

                          {/* Range Name */}
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                border: `1px solid ${tierStyle.border}`,
                              }}
                            >
                              <Award size={13} color={tierStyle.badge} />
                              {r.name}
                            </span>
                          </td>

                          {/* Monthly Spend Threshold */}
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                              Rs. {Number(r.minSpend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {isBaseline ? 'Starting base threshold' : 'Qualifying net spend'}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: r.isActive ? '#dcfce7' : '#fee2e2',
                                color: r.isActive ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>

                          {/* Customer Count */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                color: '#1e293b',
                              }}
                            >
                              {r.currentMonthCustomerCount ?? 0} customers
                            </span>
                          </td>

                          {/* Description */}
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem', maxWidth: '240px' }}>
                            {r.description || '—'}
                          </td>

                          {/* Action Buttons */}
                          {canEdit && (
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRange(r)}
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  title="Edit range details"
                                >
                                  <Edit2 size={12} /> Edit
                                </button>

                                {!isBaseline && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRangeStatus(r)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: r.isActive ? '#fff1f2' : '#f0fdf4',
                                      color: r.isActive ? '#be123c' : '#15803d',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {r.isActive ? 'Deactivate' : 'Activate'}
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
          TAB 3: SCREEN D — MONTHLY REPORTS & STAFF PERFORMANCE
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Month Selector & Report Actions */}
          <div
            className="glass-card"
            style={{
              padding: '16px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>Report Month:</span>
              </div>
              <input
                type="month"
                className="input-glass"
                style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, width: '170px' }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportStaffCSV}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}
              >
                <Download size={14} /> Export Staff Report
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}
              >
                <FileText size={14} /> Print Report
              </button>
            </div>
          </div>

          {/* Range Tier Distribution Breakdown */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
              Customer Range Distribution ({dashboardData?.monthLabel || selectedMonth})
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
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
                      padding: '14px',
                      borderRadius: '10px',
                      background: tierStyle.bg,
                      border: `1px solid ${tierStyle.border}`,
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: tierStyle.text }}>
                      {rangeName}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: tierStyle.text, marginTop: '4px' }}>
                      {count}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: tierStyle.text, opacity: 0.85, marginTop: '2px' }}>
                      {percentage}% of customers
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff Performance & Customer Achievement Breakdown */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                Staff Member Target Achievements & Customer Conversions
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Tracks each sales representative's assigned customers, active purchasing customers, and customers reaching Range 1+
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem' }}>
                    <th style={{ padding: '12px 18px' }}>STAFF MEMBER</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ASSIGNED CUSTOMERS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIVE PURCHASERS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>PROMOTED (RANGE 1+)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>TOTAL QUALIFYING SALES</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>CONVERSION RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingReports ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                        Loading staff performance...
                      </td>
                    </tr>
                  ) : staffPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No staff assignments found for this month. Assign customers to staff members in the Customer Dashboard.
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
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.staffName}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>@{p.staffUsername}</div>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>
                            {totalAssigned}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>{active}</span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> ({totalAssigned > 0 ? Math.round((active / totalAssigned) * 100) : 0}%)</span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: promoted > 0 ? '#fef3c7' : '#f1f5f9',
                                color: promoted > 0 ? '#b45309' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                              }}
                            >
                              {promoted} customers
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                            Rs. {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: Number(conversion) >= 50 ? '#16a34a' : '#475569' }}>
                              {conversion}%
                            </div>
                            <div style={{ height: '4px', width: '60px', background: '#e2e8f0', borderRadius: '2px', margin: '3px auto 0' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(0, conversion))}%`,
                                  background: Number(conversion) >= 50 ? '#16a34a' : '#3b82f6',
                                  borderRadius: '2px',
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
          TAB 4: PROMOTIONAL CAMPAIGN TARGETS (V5 CAMPAIGNS)
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
          MODAL: CREATE / EDIT RANGE (SCREEN A)
         ───────────────────────────────────────────────────────────── */}
      {showRangeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingRange ? 'Edit Range Tier' : 'New Range Tier'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRangeModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Range Code *
                </label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ width: '100%', textTransform: 'uppercase', fontFamily: 'monospace' }}
                  disabled={!!editingRange}
                  value={rangeForm.rangeCode}
                  onChange={(e) => setRangeForm({ ...rangeForm, rangeCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Range Display Name * (e.g. Range 1, Bronze, Silver)
                </label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ width: '100%' }}
                  value={rangeForm.name}
                  onChange={(e) => setRangeForm({ ...rangeForm, name: e.target.value })}
                  placeholder="e.g. Range 1"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Monthly Purchase Threshold (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-glass"
                  style={{ width: '100%', fontWeight: 700 }}
                  value={rangeForm.minSpend}
                  disabled={editingRange && editingRange.rangeCode === 'RANGE_0'}
                  onChange={(e) => setRangeForm({ ...rangeForm, minSpend: e.target.value })}
                  placeholder="e.g. 50000"
                  required
                />
                {editingRange && editingRange.rangeCode === 'RANGE_0' && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Range 0 is the starting base tier and must always remain at Rs. 0.00.
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-glass"
                    style={{ width: '100%' }}
                    value={rangeForm.displayOrder}
                    onChange={(e) => setRangeForm({ ...rangeForm, displayOrder: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Active Status
                  </label>
                  <select
                    className="input-glass"
                    style={{ width: '100%' }}
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Description (Optional)
                </label>
                <textarea
                  className="input-glass"
                  rows={2}
                  style={{ width: '100%', resize: 'none' }}
                  value={rangeForm.description}
                  onChange={(e) => setRangeForm({ ...rangeForm, description: e.target.value })}
                  placeholder="Notes about this customer range milestone..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  className="btn-secondary"
                  disabled={savingRange}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingRange}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {savingRange ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
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
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
              borderRadius: '14px',
              maxWidth: '680px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Range Configuration Audit Trail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b' }}>
              Maintains an immutable record of changes to ranges, threshold edits, and tier promotions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  No audit logs recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: log.actionType?.includes('CREATE') ? '#dcfce7' : '#e0f2fe',
                          color: log.actionType?.includes('CREATE') ? '#15803d' : '#0369a1',
                        }}
                      >
                        {log.actionType}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {new Date(log.performedAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{log.details}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
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
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
              borderRadius: '14px',
              maxWidth: '640px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Monthly Range History
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {historyCustomer.customerName} ({historyCustomer.customerCode})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b' }}>
              Historical record of qualifying purchases and achieved ranges preserved across every monthly calculation cycle.
            </p>

            {loadingHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                Loading history...
              </div>
            ) : customerHistory.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                No past monthly history records found for this customer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {customerHistory.map((h) => {
                  const tierStyle = getTierBadgeStyle(h.finalRangeCode, h.finalRangeName);
                  return (
                    <div
                      key={h.yearMonth}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
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
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                          {h.monthLabel || h.yearMonth}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Invoices: {h.invoiceCount || 0} • Last Purchase: {h.lastPurchaseDate || 'None'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                          Rs. {Number(h.qualifyingPurchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: tierStyle.bg,
                            color: tierStyle.text,
                            border: `1px solid ${tierStyle.border}`,
                            marginTop: '2px',
                          }}
                        >
                          <Award size={11} color={tierStyle.badge} />
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
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
              borderRadius: '14px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Assign Customer to Staff
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssigningCustomer(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                {assigningCustomer.customerName}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Code: {assigningCustomer.customerCode} • Currently: {assigningCustomer.assignedStaffName || 'Unassigned'}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Select Sales Representative / Staff Member:
              </label>
              <select
                className="input-glass"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
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
              <button
                type="button"
                onClick={() => setAssigningCustomer(null)}
                className="btn-secondary"
                disabled={savingAssignStaff}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignStaff}
                className="btn-primary"
                disabled={savingAssignStaff}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {savingAssignStaff ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
