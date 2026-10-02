import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  Download,
  Users,
  CheckCircle2,
  Edit3,
  SlidersHorizontal,
  Clock,
  ChevronRight,
  User,
  Layers,
  ArrowRight,
  Eye,
  X,
  FileSpreadsheet,
  AlertCircle,
  Activity,
  Sparkles,
} from 'lucide-react';
import { auditApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';

export default function AuditHub({ activeSubTab = 'day-summary', onSubTabChange }) {
  const { addToast } = useToast();

  // Selected Day (YYYY-MM-DD)
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // Data states
  const [daySummary, setDaySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedActionType, setSelectedActionType] = useState('ALL');
  const [selectedStaff, setSelectedStaff] = useState('ALL');

  // Modal / Detail state
  const [viewingLog, setViewingLog] = useState(null);

  // Fetch Day Summary for selected date
  const fetchDaySummary = useCallback(async (dateStr, isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await auditApi.getDaySummary(dateStr);
      setDaySummary(data);
    } catch (err) {
      console.error('Failed to fetch day summary:', err);
      addToast('Failed to load audit day summary: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchDaySummary(selectedDate);
  }, [selectedDate, fetchDaySummary]);

  // Quick Date Selectors
  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    if (!daySummary?.logs) return [];
    let list = [...daySummary.logs];

    // Module filter
    if (selectedModule !== 'ALL') {
      list = list.filter((l) => (l.module || '').toUpperCase() === selectedModule.toUpperCase());
    }

    // Action filter
    if (selectedActionType !== 'ALL') {
      if (selectedActionType === 'CREATE') {
        list = list.filter((l) => (l.action || '').includes('CREATE') || (l.action || '').includes('ADD'));
      } else if (selectedActionType === 'UPDATE') {
        list = list.filter((l) => (l.action || '').includes('UPDATE') || (l.action || '').includes('EDIT') || (l.action || '').includes('MODIFY'));
      } else if (selectedActionType === 'STATUS') {
        list = list.filter((l) => (l.action || '').includes('STATUS') || (l.action || '').includes('TOGGLE') || (l.action || '').includes('APPROVE') || (l.action || '').includes('REJECT'));
      }
    }

    // Staff filter
    if (selectedStaff !== 'ALL') {
      list = list.filter(
        (l) =>
          l.username === selectedStaff ||
          l.userFullName === selectedStaff ||
          l.operator === selectedStaff
      );
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.userFullName && l.userFullName.toLowerCase().includes(q)) ||
          (l.action && l.action.toLowerCase().includes(q)) ||
          (l.module && l.module.toLowerCase().includes(q)) ||
          (l.entityName && l.entityName.toLowerCase().includes(q)) ||
          (l.entityId && String(l.entityId).toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q))
      );
    }

    return list;
  }, [daySummary, selectedModule, selectedActionType, selectedStaff, searchTerm]);

  // Available Modules from current logs
  const availableModules = useMemo(() => {
    if (!daySummary?.logs) return [];
    const set = new Set();
    daySummary.logs.forEach((l) => {
      if (l.module) set.add(l.module.toUpperCase());
    });
    return Array.from(set).sort();
  }, [daySummary]);

  // Unique staff list with operation counts
  const staffActivityList = useMemo(() => {
    if (!daySummary?.userBreakdown) return [];
    return Object.entries(daySummary.userBreakdown).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [daySummary]);

  // Export to CSV
  const handleExportCsv = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      addToast('No audit logs available to export.', 'info');
      return;
    }

    const headers = ['Timestamp', 'Staff Member', 'Role', 'Module', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      l.createdAt || '',
      `"${(l.userFullName || l.username || 'System').replace(/"/g, '""')}"`,
      l.userRole || '',
      l.module || '',
      l.action || '',
      l.entityName || '',
      l.entityId || '',
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ipAddress || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NBH_Audit_Day_Summary_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Audit log exported successfully.', 'success');
  };

  // Badge styling helpers
  const getActionColor = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD')) {
      return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: 'CREATED' };
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MODIFY')) {
      return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'UPDATED' };
    }
    if (act.includes('STATUS') || act.includes('TOGGLE')) {
      return { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', label: 'STATUS CHANGED' };
    }
    if (act.includes('APPROVE')) {
      return { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7', label: 'APPROVED' };
    }
    if (act.includes('REJECT')) {
      return { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3', label: 'REJECTED' };
    }
    if (act.includes('LOGIN')) {
      return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'AUTH LOGIN' };
    }
    return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: action };
  };

  const getModuleColor = (mod = '') => {
    const m = (mod || '').toUpperCase();
    switch (m) {
      case 'SALES':
      case 'INVOICE':
        return { bg: '#eff6ff', color: '#1d4ed8' };
      case 'CUSTOMER':
        return { bg: '#f0fdf4', color: '#15803d' };
      case 'DELIVERY':
        return { bg: '#fff7ed', color: '#c2410c' };
      case 'INVENTORY':
      case 'PRODUCT':
        return { bg: '#f5f3ff', color: '#6d28d9' };
      case 'SUPPLIER':
      case 'PURCHASING':
        return { bg: '#fef3c7', color: '#b45309' };
      case 'USER':
      case 'ROLE':
      case 'EMPLOYEE':
        return { bg: '#fdf2f8', color: '#be185d' };
      case 'WAREHOUSE':
        return { bg: '#ecfeff', color: '#0e7490' };
      default:
        return { bg: '#f8fafc', color: '#475569' };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* TOP HEADER */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.1)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Day Summary & Audit Ledger
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Permanent, tamper-proof record of all operations and staff actions in NBH ERP
            </p>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Date Pills */}
          <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            <button
              type="button"
              onClick={() => setQuickDate(0)}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: selectedDate === getTodayStr() ? '#ffffff' : 'transparent',
                color: selectedDate === getTodayStr() ? '#0f172a' : '#64748b',
                boxShadow: selectedDate === getTodayStr() ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(-1)}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: selectedDate !== getTodayStr() ? '#ffffff' : 'transparent',
                color: selectedDate !== getTodayStr() ? '#0f172a' : '#64748b',
                boxShadow: selectedDate !== getTodayStr() ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Yesterday
            </button>
          </div>

          {/* Date Picker Input */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
            <Calendar size={15} style={{ position: 'absolute', left: '10px', color: '#64748b', pointerEvents: 'none' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getTodayStr()}
              style={{
                padding: '7px 12px 7px 32px',
                fontSize: '0.84rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDaySummary(selectedDate, true)}
            disabled={loading || refreshing}
            title="Refresh day's audit entries"
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !filteredLogs.length}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: loading || !filteredLogs.length ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div
        style={{
          padding: '16px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        {/* Card 1: Total Operations */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Operations
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
              {loading ? '...' : (daySummary?.totalActions || 0)}
            </div>
          </div>
        </div>

        {/* Card 2: Records Created */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Records Created
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
              {loading ? '...' : (daySummary?.totalCreates || 0)}
            </div>
          </div>
        </div>

        {/* Card 3: Records Updated */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Edit3 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Modifications / Edits
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#2563eb' }}>
              {loading ? '...' : (daySummary?.totalUpdates || 0)}
            </div>
          </div>
        </div>

        {/* Card 4: Status Toggles */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#f5f3ff',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Status / Approvals
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed' }}>
              {loading ? '...' : (daySummary?.totalStatusChanges || 0)}
            </div>
          </div>
        </div>

        {/* Card 5: Active Staff */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#fff7ed',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Staff Today
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ea580c' }}>
              {loading ? '...' : (staffActivityList.length || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & BREAKDOWN BAR */}
      <div
        style={{
          padding: '0 24px 14px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search staff, reference, action, detail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '0.84rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Module Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Module:</span>
            {['ALL', ...availableModules].map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setSelectedModule(mod)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: selectedModule === mod ? '#0284c7' : '#e2e8f0',
                  backgroundColor: selectedModule === mod ? '#0284c7' : '#ffffff',
                  color: selectedModule === mod ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {mod}
              </button>
            ))}
          </div>

          {/* Action Type Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Action:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CREATE', label: 'Creates' },
              { id: 'UPDATE', label: 'Updates' },
              { id: 'STATUS', label: 'Status' },
            ].map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setSelectedActionType(act.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: selectedActionType === act.id ? '#0f172a' : '#e2e8f0',
                  backgroundColor: selectedActionType === act.id ? '#0f172a' : '#f8fafc',
                  color: selectedActionType === act.id ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Members Activity Bar (if multiple staff active) */}
        {staffActivityList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Staff Filter:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStaff('ALL')}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: selectedStaff === 'ALL' ? '#0284c7' : '#e2e8f0',
                backgroundColor: selectedStaff === 'ALL' ? '#eff6ff' : '#ffffff',
                color: selectedStaff === 'ALL' ? '#0284c7' : '#64748b',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              All Staff ({daySummary?.logs?.length || 0})
            </button>
            {staffActivityList.map((st) => (
              <button
                key={st.name}
                type="button"
                onClick={() => setSelectedStaff(st.name)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: selectedStaff === st.name ? '#0284c7' : '#e2e8f0',
                  backgroundColor: selectedStaff === st.name ? '#eff6ff' : '#ffffff',
                  color: selectedStaff === st.name ? '#0284c7' : '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <User size={12} />
                <span>{st.name}</span>
                <span
                  style={{
                    backgroundColor: selectedStaff === st.name ? '#0284c7' : '#f1f5f9',
                    color: selectedStaff === st.name ? '#ffffff' : '#64748b',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AUDIT LOG TABLE / LEDGER WORKSPACE */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '0 24px 20px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Table Header Bar */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fafbfc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
              Audit Entries for {selectedDate}
            </span>
            <span
              style={{
                backgroundColor: '#e2e8f0',
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              {filteredLogs.length} events
            </span>
          </div>

          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            Permanent record • Deletion prohibited by policy
          </div>
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#0284c7' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading system audit trail...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <ShieldCheck size={40} style={{ margin: '0 auto 12px auto', display: 'block', color: '#cbd5e1' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                No audit entries recorded for this selection
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                Try selecting a different date or clearing your filter criteria.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700, width: '120px' }}>TIME</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, width: '180px' }}>STAFF / OPERATOR</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, width: '110px' }}>MODULE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, width: '140px' }}>ACTION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, width: '180px' }}>ENTITY / REF</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>OPERATION DETAILS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, width: '60px', textAlign: 'center' }}>VIEW</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const actionStyle = getActionColor(log.action);
                  const moduleStyle = getModuleColor(log.module);

                  // Extract time string
                  let timeStr = '--:--';
                  if (log.createdAt) {
                    try {
                      const dt = new Date(log.createdAt);
                      timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    } catch {
                      timeStr = log.createdAt.substring(11, 19) || log.createdAt;
                    }
                  }

                  return (
                    <tr
                      key={log.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.12s ease',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fbfcfd',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fbfcfd')}
                    >
                      {/* Time */}
                      <td style={{ padding: '12px 18px', whiteSpace: 'nowrap', color: '#64748b', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} style={{ color: '#94a3b8' }} />
                          {timeStr}
                        </div>
                      </td>

                      {/* Staff / Operator */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {log.userFullName || log.username || 'System'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            @{log.username || 'system'} {log.userRole ? `• ${log.userRole}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Module */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: moduleStyle.bg,
                            color: moduleStyle.color,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {log.module || 'SYSTEM'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: actionStyle.bg,
                            color: actionStyle.color,
                            border: `1px solid ${actionStyle.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {actionStyle.label}
                        </span>
                      </td>

                      {/* Entity / Reference */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            {log.entityName || '-'}
                          </span>
                          {log.entityId && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                              ID: #{log.entityId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Details */}
                      <td style={{ padding: '12px 18px', color: '#334155' }}>
                        <div
                          style={{
                            maxWidth: '480px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={log.details}
                        >
                          {log.details || '-'}
                        </div>
                      </td>

                      {/* View Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setViewingLog(log)}
                          title="View complete audit record details"
                          style={{
                            background: 'none',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            color: '#0284c7',
                            cursor: 'pointer',
                            padding: '5px 7px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.borderColor = '#bfdbfe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                          }}
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAIL MODAL: Complete Immutable Audit Record */}
      {viewingLog && (
        <div
          className="modal-backdrop"
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
          onClick={() => setViewingLog(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '620px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#fafbfc',
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
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Audit Event #{viewingLog.id || 'N/A'}
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Recorded at {viewingLog.createdAt}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Event Attributes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>STAFF MEMBER</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {viewingLog.userFullName || viewingLog.username || 'System'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>@{viewingLog.username || 'system'}</div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>USER ROLE & PERMISSION</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                    {viewingLog.userRole || 'AUTHORIZED_STAFF'}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>SYSTEM MODULE</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {viewingLog.module || 'SYSTEM'}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ACTION TRIGGERED</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {viewingLog.action}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TARGET ENTITY</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {viewingLog.entityName || 'N/A'} (ID: {viewingLog.entityId || 'N/A'})
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CLIENT IP ADDRESS</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginTop: '2px', fontFamily: 'monospace' }}>
                    {viewingLog.ipAddress || 'Internal / Local'}
                  </div>
                </div>
              </div>

              {/* Operation Details */}
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Operation Audit Note & Payload
                </div>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {viewingLog.details || 'No additional detail recorded for this event.'}
                </div>
              </div>

              {/* Compliance Notice */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: '#92400e',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  NBH ERP Compliance Rule: Records in this system cannot be deleted. Any changes made by staff are permanently linked to their user account.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#fafbfc',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
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
    </div>
  );
}
