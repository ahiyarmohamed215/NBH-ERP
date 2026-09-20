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

  // Active sub-tab state: 'list' | 'groups' | 'attendance' | 'payroll' | 'commissions'
  const [activeTab, setActiveTab] = useState(() => {
    if (activeSubTab === 'roles' || activeSubTab === 'groups') return 'groups';
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

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

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
      setActiveTab('groups');
    } else if (activeSubTab === 'users' || activeSubTab === 'list') {
      setActiveTab('list');
    }
  }, [activeSubTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId === 'groups' ? 'roles' : tabId);
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
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter((emp) => {
      const nameMatch = emp.fullName && emp.fullName.toLowerCase().includes(q);
      const userMatch = emp.username && emp.username.toLowerCase().includes(q);
      const emailMatch = emp.email && emp.email.toLowerCase().includes(q);
      const phoneMatch = emp.phone && emp.phone.includes(q);
      const roleMatch = emp.roles && emp.roles.some((r) => r.toLowerCase().includes(q));
      return nameMatch || userMatch || emailMatch || phoneMatch || roleMatch;
    });
  }, [employees, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    if (employees.length === 0) {
      addToast('No employee records to export', 'info');
      return;
    }

    const headers = ['EMPLOYEE', 'USERNAME', 'ROLE', 'TYPE', 'CONTACT_PHONE', 'EMAIL', 'JOINED', 'STATUS'];
    const rows = employees.map((emp) => [
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
    <div style={{ padding: '28px 36px', minHeight: '100%', backgroundColor: '#f8fafc' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
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

      {/* Subtabs Bar (Underline Style exactly as in screenshot) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '24px',
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
          <Users size={16} /> Groups
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pending Employee Approvals Banner (Styled exactly like image) */}
          {pendingApprovals.length > 0 && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef08a',
                borderRadius: '10px',
                padding: '18px 24px',
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

          {/* Search Bar & Action Buttons (Import & Export CSV) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <Search
                size={17}
                style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder="Search employees by name, code, role, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleExportCSV}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* Employees Table (Clean, matches screenshot layout) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 20px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    EMPLOYEE
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ROLE
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    TYPE
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CONTACT
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    JOINED
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    STATUS
                  </th>
                  <th style={{ padding: '12px 20px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
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
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.1s ease',
                        }}
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
                            onClick={() => handleToggleActive(emp)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              color: emp.isActive ? '#16a34a' : '#dc2626',
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
                            {emp.isActive ? 'active' : 'inactive'}
                          </button>
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(emp)}
                              style={{
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '5px 7px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Edit Employee"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(emp)}
                              style={{
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '5px 7px',
                                cursor: 'pointer',
                                color: emp.isActive ? '#16a34a' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={emp.isActive ? 'Deactivate Employee' : 'Activate Employee'}
                            >
                              {emp.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
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
      )}

      {/* Tab 2: Groups & Permissions (Renders RolesView) */}
      {activeTab === 'groups' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '8px' }}>
          <RolesView />
        </div>
      )}

      {/* Tab 3: Attendance (Placeholder) */}
      {activeTab === 'attendance' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '60px 24px',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '20px auto',
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
      )}

      {/* Tab 4: Payroll (Placeholder) */}
      {activeTab === 'payroll' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '60px 24px',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '20px auto',
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
      )}

      {/* Tab 5: Commission Templates (Placeholder) */}
      {activeTab === 'commissions' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '60px 24px',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '20px auto',
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
    </div>
  );
}
