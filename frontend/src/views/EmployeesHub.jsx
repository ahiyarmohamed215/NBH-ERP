import React, { useState, useEffect, useMemo } from 'react';
import { userApi, roleApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import RolesView from './RolesView';
import {
  Users,
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  X,
  Phone,
  Mail,
  Shield,
  ShieldCheck,
  Clock,
  Calendar,
  CreditCard,
  Percent,
  ListFilter,
  Check,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react';

export default function EmployeesHub({ activeSubTab, onSubTabChange }) {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  // Active sub-tab state: 'list' | 'roles' | 'attendance' | 'payroll' | 'commissions'
  const [activeTab, setActiveTab] = useState(() => {
    if (activeSubTab === 'roles' || activeSubTab === 'groups') return 'roles';
    return 'list';
  });

  // Pending approvals card toggle
  const [hidePending, setHidePending] = useState(false);

  // Data states
  const [employees, setEmployees] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Add / Edit form data
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    employeeType: 'Full-time',
    roles: [],
  });
  const [selectedApproveRoles, setSelectedApproveRoles] = useState([]);
  const [approveType, setApproveType] = useState('Full-time');
  const [submitting, setSubmitting] = useState(false);

  // Sync external tab changes
  useEffect(() => {
    if (activeSubTab === 'roles' || activeSubTab === 'groups') {
      setActiveTab('roles');
    } else if (activeSubTab === 'users' || activeSubTab === 'list') {
      setActiveTab('list');
    }
  }, [activeSubTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // Fetch users and roles
  const loadData = async () => {
    try {
      setLoading(true);
      const [allRes, pendingRes, rolesRes] = await Promise.all([
        userApi.getAll({ page: 0, size: 200 }),
        userApi.getPending({ page: 0, size: 50 }),
        roleApi.getAll(),
      ]);

      setEmployees(allRes.data?.content || allRes.data || []);
      setPendingApprovals(pendingRes.data?.content || pendingRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load employee records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format role name for display (e.g., ROLE_MANAGER -> Manager)
  const formatRoleName = (rName) => {
    if (!rName) return 'Staff';
    if (rName.startsWith('ROLE_')) {
      const clean = rName.replace('ROLE_', '');
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return rName;
  };

  const getPrimaryRole = (user) => {
    if (!user.roles || user.roles.length === 0) return 'Employee';
    const mainRole = user.roles.find((r) => r === 'ROLE_ADMIN') || user.roles[0];
    return formatRoleName(mainRole);
  };

  // Format joined date
  const formatJoinedDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !emp.isActive) return false;
      if (statusFilter === 'INACTIVE' && emp.isActive) return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = emp.fullName && emp.fullName.toLowerCase().includes(q);
      const userMatch = emp.username && emp.username.toLowerCase().includes(q);
      const emailMatch = emp.email && emp.email.toLowerCase().includes(q);
      const phoneMatch = emp.phone && emp.phone.includes(q);
      const roleMatch = emp.roles && emp.roles.some((r) => r.toLowerCase().includes(q));
      return nameMatch || userMatch || emailMatch || phoneMatch || roleMatch;
    });
  }, [employees, searchQuery, statusFilter]);

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = filteredEmployees.length > 0 ? filteredEmployees : employees;
    if (listToExport.length === 0) {
      addToast('No employee records to export', 'info');
      return;
    }

    const headers = ['EMPLOYEE', 'USERNAME', 'ROLE', 'TYPE', 'CONTACT_PHONE', 'EMAIL', 'JOINED', 'STATUS'];
    const rows = listToExport.map((emp) => [
      `"${emp.fullName || emp.username}"`,
      `"${emp.username}"`,
      `"${getPrimaryRole(emp)}"`,
      `"Full-time"`,
      `"${emp.phone || ''}"`,
      `"${emp.email || ''}"`,
      `"${formatJoinedDate(emp.createdAt)}"`,
      `"${emp.isActive ? 'active' : 'inactive'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Employee CSV exported successfully', 'success');
  };

  // Toggle active
  const handleToggleActive = async (emp) => {
    try {
      await userApi.toggleActive(emp.id);
      addToast(`Status updated for ${emp.fullName || emp.username}`, 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Delete employee
  const handleInitiateDeleteEmployee = (emp) => {
    if (currentUser && (currentUser.id === emp.id || currentUser.username === emp.username)) {
      addToast('You cannot delete your own logged-in employee account.', 'error');
      return;
    }
    setEmployeeToDelete(emp);
  };

  const handleExecuteDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    try {
      setDeletingId(employeeToDelete.id);
      await userApi.delete(employeeToDelete.id);
      addToast(`Employee "${employeeToDelete.fullName || employeeToDelete.username}" deleted successfully`, 'success');
      if (viewingEmployee?.id === employeeToDelete.id) {
        setViewingEmployee(null);
      }
      setEmployeeToDelete(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to delete employee record', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Add Employee
  const handleOpenAdd = () => {
    setFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      password: '',
      employeeType: 'Full-time',
      roles: roles.length > 0 ? [roles[0].name] : ['ROLE_CASHIER'],
    });
    setShowAddModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password) {
      addToast('Username and password are required', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await userApi.create({
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        roles: formData.roles,
      });
      addToast(`Employee "${formData.fullName || formData.username}" created successfully`, 'success');
      setShowAddModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Employee
  const handleOpenEdit = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      username: emp.username,
      fullName: emp.fullName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      password: '',
      employeeType: 'Full-time',
      roles: emp.roles || [],
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      setSubmitting(true);
      await userApi.update(selectedEmployee.id, {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password || undefined,
        roles: formData.roles,
      });
      addToast(`Employee "${formData.fullName || selectedEmployee.username}" updated`, 'success');
      setShowEditModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to update employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Complete & Approve
  const handleOpenApprove = (pendingUser) => {
    setSelectedEmployee(pendingUser);
    const defaultRole = roles.find((r) => r.name !== 'ROLE_ADMIN') || roles[0];
    setSelectedApproveRoles(defaultRole ? [defaultRole.name] : ['ROLE_CASHIER']);
    setApproveType('Full-time');
    setShowApproveModal(true);
  };

  const handleCompleteApprove = async () => {
    if (!selectedEmployee) return;
    if (selectedApproveRoles.length === 0) {
      addToast('Please assign at least one role to this employee', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await userApi.approve(selectedEmployee.id, selectedApproveRoles);
      addToast(`Employee "${selectedEmployee.fullName || selectedEmployee.username}" approved successfully`, 'success');
      setShowApproveModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Approval failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reject approval
  const handleReject = async (pendingUser) => {
    if (!window.confirm(`Are you sure you want to reject registration for "${pendingUser.username}"?`)) return;
    try {
      await userApi.reject(pendingUser.id);
      addToast(`Registration for ${pendingUser.username} was rejected`, 'info');
      loadData();
    } catch (err) {
      addToast(err.message || 'Rejection failed', 'error');
    }
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
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Page Header (Fixed / Sticky at Top) */}
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
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Employees
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Create and manage employee records for this branch.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn btn-primary"
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
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={17} /> Add Employee
        </button>
      </div>

      {/* Subtabs Bar (Underline Style - Fixed / Sticky at Top) */}
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
          <ListFilter size={16} /> Employee List
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('roles')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'roles' || activeTab === 'groups' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'roles' || activeTab === 'groups' ? 700 : 500,
            color: activeTab === 'roles' || activeTab === 'groups' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Shield size={16} /> Roles
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('attendance')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'attendance' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'attendance' ? 700 : 500,
            color: activeTab === 'attendance' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Calendar size={16} /> Attendance
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('payroll')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'payroll' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'payroll' ? 700 : 500,
            color: activeTab === 'payroll' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <CreditCard size={16} /> Payroll
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('commissions')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'commissions' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'commissions' ? 700 : 500,
            color: activeTab === 'commissions' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Percent size={16} /> Commission Templates
        </button>
      </div>

      {/* Tab 1: Employee List */}
      {activeTab === 'list' && (
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
          {/* Pending Employee Approvals Banner (Styled exactly like image) */}
          {pendingApprovals.length > 0 && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef08a',
                borderRadius: '10px',
                padding: '14px 20px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b' }}>
                    Pending employee approvals
                  </span>
                  <span
                    style={{
                      backgroundColor: '#fef08a',
                      color: '#854d0e',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pendingApprovals.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setHidePending(!hidePending)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {hidePending ? 'Show' : 'Hide'} {hidePending ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '4px', marginBottom: hidePending ? 0 : '14px' }}>
                Branch users become employees only after you complete their details and approve them. Super administrators are never included.
              </div>

              {!hidePending && (
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #fef08a' }}>
                  {pendingApprovals.map((pUser) => (
                    <div
                      key={pUser.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid rgba(254, 240, 138, 0.6)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                          {pUser.fullName || pUser.username}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          {pUser.roles?.length ? pUser.roles.map(formatRoleName).join(', ') : 'Admin / Staff'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenApprove(pUser)}
                          style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            padding: '7px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Complete & approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(pUser)}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            padding: '6px 10px',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Reject Request"
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Bar & Action Buttons (Fixed / Sticky - Customer Page Look) */}
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
            {/* Left Control: Search Input */}
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
                placeholder="Search employees by name, username, email, phone, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
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

            {/* Right Controls: Status Filter, Reset, Export CSV (icon only), & Refresh (icon only) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 30px 0 12px',
                  width: '140px',
                  minWidth: '120px',
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
              {(statusFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
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

              {/* Export CSV - Icon only matching Customer page */}
              <button
                type="button"
                onClick={handleExportCSV}
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
                title="Export employees to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh Employee Records - Icon only */}
              <button
                type="button"
                onClick={loadData}
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
                title="Refresh employee records"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Employees Table (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 20px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      EMPLOYEE
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ROLE
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      TYPE
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      CONTACT
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      JOINED
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 20px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Loading employee records...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No employees found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const primaryRole = getPrimaryRole(emp);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setViewingEmployee(emp)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view employee profile"
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: '#f0fdf4',
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                border: '1px solid #bbf7d0',
                                flexShrink: 0,
                              }}
                            >
                              {(emp.fullName || emp.username).slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>
                                {emp.fullName || emp.username}
                              </div>
                              {emp.fullName && (
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>@{emp.username}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', color: '#334155', fontWeight: 500, fontSize: '0.9rem' }}>
                          {primaryRole}
                        </td>

                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.88rem' }}>
                          Full-time
                        </td>

                        <td style={{ padding: '14px 16px', color: '#334155', fontSize: '0.88rem' }}>
                          {emp.phone || emp.email || '—'}
                        </td>

                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                          {formatJoinedDate(emp.createdAt)}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(emp);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: emp.isActive ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${emp.isActive ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: emp.isActive ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(emp);
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
                              title="Edit Employee"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInitiateDeleteEmployee(emp);
                              }}
                              disabled={deletingId === emp.id}
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
                              title="Delete Employee"
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

      {/* Tab 2: Roles (Renders RolesView with Sticky Header & Scrollable Cards) */}
      {(activeTab === 'roles' || activeTab === 'groups') && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <RolesView />
        </div>
      )}

      {/* Tab 3: Attendance (Placeholder) */}
      {activeTab === 'attendance' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 0' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '60px 24px',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Calendar size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Branch Attendance & Clock-in
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 auto 20px auto' }}>
              Track daily shifts, check-in timestamps, leave requests, and branch staff work logs.
            </p>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '4px 12px', borderRadius: '9999px' }}>
              FEATURE IN PROGRESS
            </span>
          </div>
        </div>
      )}

      {/* Tab 4: Payroll (Placeholder) */}
      {activeTab === 'payroll' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 0' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '60px 24px',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CreditCard size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Employee Payroll Processing
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 auto 20px auto' }}>
              Manage monthly salary disbursements, deductions, overtime calculations, and pay slip exports.
            </p>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', backgroundColor: '#d1fae5', padding: '4px 12px', borderRadius: '9999px' }}>
              FEATURE IN PROGRESS
            </span>
          </div>
        </div>
      )}

      {/* Tab 5: Commission Templates (Placeholder) */}
      {activeTab === 'commissions' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 0' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '60px 24px',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Percent size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Sales Commission Templates
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 auto 20px auto' }}>
              Configure commission tiers for POS cashiers, managers, and branch sales representatives.
            </p>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d97706', backgroundColor: '#fef3c7', padding: '4px 12px', borderRadius: '9999px' }}>
              FEATURE IN PROGRESS
            </span>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '620px', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                Add New Employee
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    type="text"
                    className="input-glass"
                    required
                    placeholder="e.g. Abdul Rahman"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Username (Login ID) *</label>
                  <input
                    type="text"
                    className="input-glass"
                    required
                    placeholder="e.g. abdul"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input-glass"
                    placeholder="e.g. abdul@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone / Contact</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="e.g. 0785677332"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Temporary Password *</label>
                  <input
                    type="password"
                    className="input-glass"
                    required
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Employee Type</label>
                  <select
                    className="input-glass"
                    value={formData.employeeType}
                    onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label className="label">Assigned Roles / Groups</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {roles.map((r) => {
                    const isSelected = formData.roles.includes(r.name);
                    return (
                      <button
                        key={r.id || r.name}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            roles: isSelected
                              ? formData.roles.filter((name) => name !== r.name)
                              : [...formData.roles, r.name],
                          });
                        }}
                        style={{
                          backgroundColor: isSelected ? '#0284c7' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#334155',
                          border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {formatRoleName(r.name)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '620px', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                Edit Employee: {selectedEmployee.fullName || selectedEmployee.username}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    className="input-glass"
                    disabled
                    value={formData.username}
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input-glass"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Reset Password (optional)</label>
                  <input
                    type="password"
                    className="input-glass"
                    placeholder="Leave blank to keep current"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Employee Type</label>
                  <select
                    className="input-glass"
                    value={formData.employeeType}
                    onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label className="label">Assigned Roles / Groups</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {roles.map((r) => {
                    const isSelected = formData.roles.includes(r.name);
                    return (
                      <button
                        key={r.id || r.name}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            roles: isSelected
                              ? formData.roles.filter((name) => name !== r.name)
                              : [...formData.roles, r.name],
                          });
                        }}
                        style={{
                          backgroundColor: isSelected ? '#0284c7' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#334155',
                          border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {formatRoleName(r.name)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete & Approve Modal */}
      {showApproveModal && selectedEmployee && (
        <div className="modal-backdrop" onClick={() => setShowApproveModal(false)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '540px', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0 0 2px 0', fontWeight: 700 }}>
                  Complete & Approve Employee
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Assign branch roles and approve registration for {selectedEmployee.fullName || selectedEmployee.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Name: </span>
                  <strong style={{ color: '#0f172a' }}>{selectedEmployee.fullName || selectedEmployee.username}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Username: </span>
                  <strong style={{ color: '#0f172a' }}>@{selectedEmployee.username}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Email: </span>
                  <strong style={{ color: '#0f172a' }}>{selectedEmployee.email || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Phone: </span>
                  <strong style={{ color: '#0f172a' }}>{selectedEmployee.phone || '—'}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="label">Employee Type</label>
              <select
                className="input-glass"
                value={approveType}
                onChange={(e) => setApproveType(e.target.value)}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="label">Assign Roles *</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {roles.map((r) => {
                  const isSelected = selectedApproveRoles.includes(r.name);
                  return (
                    <button
                      key={r.id || r.name}
                      type="button"
                      onClick={() => {
                        setSelectedApproveRoles(
                          isSelected
                            ? selectedApproveRoles.filter((n) => n !== r.name)
                            : [...selectedApproveRoles, r.name]
                        );
                      }}
                      style={{
                        backgroundColor: isSelected ? '#0284c7' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#334155',
                        border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        padding: '7px 14px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {formatRoleName(r.name)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setShowApproveModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || selectedApproveRoles.length === 0}
                onClick={handleCompleteApprove}
              >
                {submitting ? 'Approving...' : 'Complete & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Employee Profile View Popup (When clicking row / View)  */}
      {/* ------------------------------------------------------------- */}
      {viewingEmployee && (
        <div className="modal-backdrop" onClick={() => setViewingEmployee(null)}>
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
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    flexShrink: 0,
                  }}
                >
                  {(viewingEmployee.fullName || viewingEmployee.username || 'E').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      {viewingEmployee.fullName || viewingEmployee.username}
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
                      @{viewingEmployee.username}
                    </span>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: viewingEmployee.isActive ? '#dcfce7' : '#fee2e2',
                        color: viewingEmployee.isActive ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {viewingEmployee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>
                    Role: <strong style={{ color: '#0284c7' }}>{getPrimaryRole(viewingEmployee)}</strong>
                    {viewingEmployee.email && <span> • {viewingEmployee.email}</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployee;
                    setViewingEmployee(null);
                    handleOpenEdit(emp);
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
                    const emp = viewingEmployee;
                    handleInitiateDeleteEmployee(emp);
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
                  onClick={() => setViewingEmployee(null)}
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
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Full Name</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingEmployee.fullName || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Username</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>@{viewingEmployee.username}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Phone Number</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingEmployee.phone || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Email Address</span>
                    <span style={{ color: '#334155' }}>{viewingEmployee.email || '—'}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '10px' }}>
                  Employment Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Employment Type</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Full-time</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Account Status</span>
                    <span style={{ fontWeight: 600, color: viewingEmployee.isActive ? '#16a34a' : '#dc2626' }}>
                      {viewingEmployee.isActive ? 'Active (Operational)' : 'Inactive / Disabled'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Approval Status</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {viewingEmployee.approvalStatus || 'APPROVED'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Joined Date</span>
                    <span style={{ color: '#334155' }}>{formatJoinedDate(viewingEmployee.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '10px' }}>
                  Roles & Permissions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                      Primary Designation
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #dbeafe',
                        borderRadius: '5px',
                        padding: '2px 8px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                      }}
                    >
                      {getPrimaryRole(viewingEmployee)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '6px' }}>
                      Assigned System Roles ({viewingEmployee.roles?.length || 0})
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {viewingEmployee.roles && viewingEmployee.roles.length > 0 ? (
                        viewingEmployee.roles.map((r, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                            }}
                          >
                            <ShieldCheck size={11} color="#0284c7" /> {formatRoleName(r)}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No explicit roles</span>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>User ID</span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>#{viewingEmployee.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick footer toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  await handleToggleActive(viewingEmployee);
                  setViewingEmployee((prev) => (prev ? { ...prev, isActive: !prev.isActive } : null));
                }}
                style={{
                  backgroundColor: viewingEmployee.isActive ? '#fff1f2' : '#f0fdf4',
                  color: viewingEmployee.isActive ? '#e11d48' : '#16a34a',
                  border: `1px solid ${viewingEmployee.isActive ? '#fecdd3' : '#bbf7d0'}`,
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {viewingEmployee.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                {viewingEmployee.isActive ? 'Deactivate Employee' : 'Activate Employee'}
              </button>

              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
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
      {/* MODAL: Delete Employee Confirmation Dialog                     */}
      {/* ------------------------------------------------------------- */}
      {employeeToDelete && (
        <div className="modal-backdrop" onClick={() => !deletingId && setEmployeeToDelete(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
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
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Delete Employee
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  This action will permanently remove the employee.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.85rem',
                color: '#991b1b',
                marginBottom: '18px',
                lineHeight: '1.4',
              }}
            >
              Are you sure you want to delete employee <strong>"{employeeToDelete.fullName || employeeToDelete.username}"</strong> (@{employeeToDelete.username})? This action cannot be undone.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setEmployeeToDelete(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleExecuteDeleteEmployee}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} /> {deletingId ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
