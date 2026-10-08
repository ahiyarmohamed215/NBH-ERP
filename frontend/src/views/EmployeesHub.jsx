import { useState, useEffect, useMemo } from 'react';
import { userApi, roleApi, pdfApi } from '../api/apiClient';
import { useDataSync } from '../hooks/useDataSync';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
import { printA4Report } from '../utils/printReport';
import { ToolbarActions, TableRowActions } from '../components/ToolbarActions';
import RoleSearchSelector from '../components/RoleSearchSelector';
import RolesView from './RolesView';
import { Plus, Search, Edit2, CheckCircle, X, Phone, Mail, Shield, ShieldCheck, Clock, ListFilter, Check, UserCheck, UserX, Info } from 'lucide-react';

export default function EmployeesHub({ activeSubTab, onSubTabChange }) {
  const { user: currentUser } = useAuth();
  const canEditUser = canEditModule(currentUser, 'USER');
  const { addToast } = useToast();

  const isSuperAdminUser = (emp) => {
    if (!emp) return false;
    if (emp.username === 'admin') return true;
    const rList = emp.roles || [];
    return rList.some((r) => {
      const name = typeof r === 'string' ? r : r?.name;
      return name === 'ROLE_SUPER_ADMIN' || name === 'SUPER_ADMIN';
    });
  };

  // Old links to unfinished modules fall back to the employee list.
  const resolveTab = tab => {
    if (tab === 'roles' || tab === 'groups') return 'roles';
    if (tab === 'pending-approvals' || tab === 'approvals') return 'pending-approvals';
    return 'list';
  };
  const [activeTab, setActiveTab] = useState(() => resolveTab(activeSubTab));

  // Pending approvals card toggle
  const [hidePending, setHidePending] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');

  // Data states
  const [employees, setEmployees] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Unified Modal state: 'add' | 'edit' | 'approve' | null
  const [modalMode, setModalMode] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [viewingPendingEmployee, setViewingPendingEmployee] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve' | 'reject', user: Object }

  // Form data for Add / Edit / Approve
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    employeeCode: '',
    password: '',
    employeeType: 'Full-time',
    roles: [],
  });

  // Inline role creation in modal
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [showInlineCreateRole, setShowInlineCreateRole] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ name: '', description: '' });
  const [creatingRole, setCreatingRole] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Sync external tab changes.
  useEffect(() => {
    setActiveTab(resolveTab(activeSubTab));
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
  }, [activeTab]);

  useDataSync(loadData, ['erp:data_changed', 'erp:roles_updated', 'erp:users_updated']);

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
      // Unapproved / pending registrations must not be displayed in the main Employee List
      if (emp.approvalStatus && emp.approvalStatus.toUpperCase() !== 'APPROVED') return false;

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
      const roleMatch = emp.roles && emp.roles.some((r) => {
        const str = typeof r === 'string' ? r : (r?.name || '');
        return str.toLowerCase().includes(q);
      });
      return nameMatch || userMatch || emailMatch || phoneMatch || roleMatch;
    });
  }, [employees, searchQuery, statusFilter]);

  // Filtered pending approvals
  const filteredPendingList = useMemo(() => {
    if (!pendingSearchQuery.trim()) return pendingApprovals;
    const q = pendingSearchQuery.toLowerCase().trim();
    return pendingApprovals.filter(
      (u) =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))
    );
  }, [pendingApprovals, pendingSearchQuery]);

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

  // Print Employee Directory Report (A4)
  const handlePrintEmployeeList = () => {
    const listToPrint = filteredEmployees.length > 0 ? filteredEmployees : employees;
    if (listToPrint.length === 0) {
      addToast('No employee records to print', 'info');
      return;
    }
    try {
      pdfApi.printEmployeeList();
    } catch {
      printA4Report({
        title: 'Employee Directory & Staff Roster',
        subtitle: `Total Staff: ${listToPrint.length}`,
        metaItems: [
          { label: 'Date', value: new Date().toLocaleDateString() },
          { label: 'Status Filter', value: statusFilter },
        ],
        columns: [
          { header: 'Employee', accessor: (e) => e.fullName || e.username },
          { header: 'Username', accessor: (e) => `@${e.username}` },
          { header: 'Role', accessor: (e) => getPrimaryRole(e) },
          { header: 'Phone', accessor: (e) => e.phone || '—' },
          { header: 'Email', accessor: (e) => e.email || '—' },
          { header: 'Joined', accessor: (e) => formatJoinedDate(e.createdAt) },
          { header: 'Status', accessor: (e) => (e.isActive ? 'Active' : 'Inactive'), align: 'center' },
        ],
        data: listToPrint,
      });
    }
  };

  // Download Employee Directory PDF (A4)
  const handleDownloadEmployeeListPdf = () => {
    try {
      pdfApi.downloadEmployeeList();
    } catch (err) {
      addToast('Failed to download Employee Directory PDF: ' + err.message, 'error');
    }
  };

  // Print Single Employee Profile (A4)
  const handlePrintEmployee = (emp) => {
    if (!emp) return;
    try {
      pdfApi.printEmployee(emp.id);
    } catch {
      printA4Report({
        title: 'Employee Personnel Record',
        subtitle: `${emp.fullName || emp.username} (@${emp.username})`,
        metaItems: [
          { label: 'Employee ID', value: `#${emp.id}` },
          { label: 'Code', value: emp.employeeCode || `EMP-${emp.id}` },
          { label: 'Primary Role', value: getPrimaryRole(emp) },
          { label: 'Status', value: emp.isActive ? 'Active' : 'Inactive' },
          { label: 'Phone', value: emp.phone || '—' },
          { label: 'Email', value: emp.email || '—' },
          { label: 'Joined', value: formatJoinedDate(emp.createdAt) },
        ],
        columns: [
          { header: 'Field', accessor: 'key' },
          { header: 'Details', accessor: 'val' },
        ],
        data: [
          { key: 'Full Name', val: emp.fullName || emp.username },
          { key: 'Username', val: `@${emp.username}` },
          { key: 'Phone Number', val: emp.phone || '—' },
          { key: 'Email Address', val: emp.email || '—' },
          { key: 'Assigned Roles', val: (emp.roles || []).join(', ') || 'Employee' },
          { key: 'Approval Status', val: emp.approvalStatus || 'APPROVED' },
          { key: 'Account Status', val: emp.isActive ? 'Active (Operational)' : 'Inactive / Disabled' },
        ],
      });
    }
  };

  // Download Single Employee Profile PDF (A4)
  const handleDownloadEmployeePdf = (emp) => {
    if (!emp) return;
    try {
      pdfApi.downloadEmployee(emp.id, emp.fullName || emp.username);
    } catch (err) {
      addToast('Failed to download Employee PDF: ' + err.message, 'error');
    }
  };

  // Export Pending Registrations to CSV
  const handleExportPendingCSV = () => {
    if (filteredPendingList.length === 0) {
      addToast('No pending registrations to export', 'info');
      return;
    }
    const headers = ['USERNAME', 'FULL_NAME', 'EMAIL', 'PHONE', 'REGISTERED_DATE'];
    const rows = filteredPendingList.map((u) => [
      `"${u.username || ''}"`,
      `"${u.fullName || ''}"`,
      `"${u.email || ''}"`,
      `"${u.phone || ''}"`,
      `"${formatJoinedDate(u.createdAt)}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pending_approvals_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Pending registrations CSV exported', 'success');
  };

  // Print Pending Registrations (A4)
  const handlePrintPendingList = () => {
    if (filteredPendingList.length === 0) {
      addToast('No pending registrations to print', 'info');
      return;
    }
    printA4Report({
      title: 'Pending Employee Registrations & Approval Queue',
      subtitle: `Total Pending: ${filteredPendingList.length}`,
      metaItems: [
        { label: 'Date', value: new Date().toLocaleDateString() },
        { label: 'Status', value: 'PENDING ROLE ASSIGNMENT' },
      ],
      columns: [
        { header: 'Username', accessor: (u) => `@${u.username}` },
        { header: 'Full Name', accessor: (u) => u.fullName || '—' },
        { header: 'Email', accessor: (u) => u.email || '—' },
        { header: 'Phone', accessor: (u) => u.phone || '—' },
        { header: 'Registered On', accessor: (u) => formatJoinedDate(u.createdAt) },
      ],
      data: filteredPendingList,
    });
  };

  // Toggle active
  const handleToggleActive = async (emp) => {
    if (isSuperAdminUser(emp)) {
      addToast('Super Administrator cannot be deactivated. Full access to all modules is permanent.', 'warning');
      return;
    }
    if (!canEditUser) {
      addToast('Permission denied: Only authorized staff can change employee status.', 'error');
      return;
    }
    try {
      await userApi.toggleActive(emp.id);
      addToast(`Status updated for ${emp.fullName || emp.username}`, 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Toggle role assignment selection in modal
  const toggleRoleAssignment = (roleName) => {
    setFormData((prev) => {
      const current = prev.roles || [];
      const exists = current.includes(roleName);
      const next = exists ? current.filter((r) => r !== roleName) : [...current, roleName];
      return { ...prev, roles: next };
    });
  };

  // Filter roles inside modal search
  const modalFilteredRoles = useMemo(() => {
    if (!roleSearchQuery.trim()) return roles;
    const q = roleSearchQuery.toLowerCase().trim();
    return roles.filter((r) => {
      const nameMatch = r.name && r.name.toLowerCase().includes(q);
      const descMatch = r.description && r.description.toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  }, [roles, roleSearchQuery]);

  // Create role inline directly from the modal
  const handleCreateRoleInline = async (e) => {
    e?.preventDefault?.();
    if (!newRoleForm.name.trim()) {
      addToast('Please enter a role name', 'error');
      return;
    }
    try {
      setCreatingRole(true);
      let rName = newRoleForm.name.trim();
      if (!rName.toUpperCase().startsWith('ROLE_')) {
        rName = 'ROLE_' + rName.toUpperCase().replace(/\s+/g, '_');
      }
      await roleApi.create({
        name: rName,
        description: newRoleForm.description?.trim() || '',
        permissions: [],
      });
      addToast(`Role "${rName}" created successfully`, 'success');
      // Refresh roles list
      const rolesRes = await roleApi.getAll();
      const freshRoles = rolesRes.data || [];
      setRoles(freshRoles);
      // Automatically assign the newly created role
      setFormData((prev) => ({
        ...prev,
        roles: Array.from(new Set([...(prev.roles || []), rName])),
      }));
      setNewRoleForm({ name: '', description: '' });
      setShowInlineCreateRole(false);
    } catch (err) {
      addToast(err.message || 'Failed to create role', 'error');
    } finally {
      setCreatingRole(false);
    }
  };

  // Request approval with confirmation popup
  const handleRequestApprove = (pendingUser) => {
    setConfirmAction({ type: 'approve', user: pendingUser });
  };

  // Request rejection with confirmation popup
  const handleRequestReject = (pendingUser) => {
    if (isSuperAdminUser(pendingUser)) {
      addToast('Super Administrator cannot be rejected.', 'warning');
      return;
    }
    setConfirmAction({ type: 'reject', user: pendingUser });
  };

  // Execute confirmed approval
  const executeApprove = async () => {
    if (!confirmAction?.user) return;
    const pendingUser = confirmAction.user;
    const hasRoles = pendingUser.roles && pendingUser.roles.length > 0;
    const roleLabels = hasRoles
      ? pendingUser.roles.map((r) => formatRoleName(typeof r === 'string' ? r : r.name)).join(', ')
      : null;
    try {
      setSubmitting(true);
      const payload = hasRoles
        ? { roles: pendingUser.roles.map((r) => (typeof r === 'string' ? r : r.name)) }
        : { roles: [] };
      await userApi.approve(pendingUser.id, payload);
      addToast(
        hasRoles
          ? `Staff member "${pendingUser.fullName || pendingUser.username}" approved successfully with role: ${roleLabels}`
          : `Staff member "${pendingUser.fullName || pendingUser.username}" approved successfully without system roles`,
        'success'
      );
      setConfirmAction(null);
      setViewingPendingEmployee(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Approval failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute confirmed rejection
  const executeReject = async () => {
    if (!confirmAction?.user) return;
    const pendingUser = confirmAction.user;
    try {
      setSubmitting(true);
      await userApi.reject(pendingUser.id);
      addToast(`Registration for ${pendingUser.username} was rejected`, 'info');
      setConfirmAction(null);
      setViewingPendingEmployee(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Rejection failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open modal in Add mode
  const handleOpenAdd = async () => {
    try {
      const rolesRes = await roleApi.getAll();
      if (rolesRes.data && Array.isArray(rolesRes.data)) {
        setRoles(rolesRes.data);
      }
    } catch (e) {
      console.warn('Failed to load fresh roles for add modal:', e);
    }
    setSelectedEmployee(null);
    setFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      employeeCode: '',
      password: '',
      employeeType: 'Full-time',
      roles: [],
    });
    setRoleSearchQuery('');
    setShowInlineCreateRole(false);
    setNewRoleForm({ name: '', description: '' });
    setModalMode('add');
  };

  // Open modal in Edit mode
  const handleOpenEdit = async (emp) => {
    setSelectedEmployee(emp);
    try {
      const rolesRes = await roleApi.getAll();
      if (rolesRes.data && Array.isArray(rolesRes.data)) {
        setRoles(rolesRes.data);
      }
    } catch (e) {
      console.warn('Failed to load fresh roles for edit modal:', e);
    }
    setFormData({
      username: emp.username || '',
      fullName: emp.fullName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      employeeCode: emp.employeeCode || '',
      password: '',
      employeeType: 'Full-time',
      roles: (emp.roles || []).map((r) => (typeof r === 'string' ? r : r.name)),
    });
    setRoleSearchQuery('');
    setShowInlineCreateRole(false);
    setNewRoleForm({ name: '', description: '' });
    setModalMode('edit');
  };

  // Open modal in Review & Approve mode
  const handleOpenApprove = async (pendingUser) => {
    setSelectedEmployee(pendingUser);
    try {
      const rolesRes = await roleApi.getAll();
      if (rolesRes.data && Array.isArray(rolesRes.data)) {
        setRoles(rolesRes.data);
      }
    } catch (e) {
      console.warn('Failed to load fresh roles for approve modal:', e);
    }
    setFormData({
      username: pendingUser.username || '',
      fullName: pendingUser.fullName || '',
      email: pendingUser.email || '',
      phone: pendingUser.phone || '',
      employeeCode: pendingUser.employeeCode || '',
      password: '',
      employeeType: 'Full-time',
      roles: (pendingUser.roles || []).map((r) => (typeof r === 'string' ? r : r.name)),
    });
    setRoleSearchQuery('');
    setShowInlineCreateRole(false);
    setNewRoleForm({ name: '', description: '' });
    setModalMode('approve');
  };

  // Unified Save handler for Add / Edit / Approve
  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
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
          roles: formData.roles || [],
        });
        addToast(`Employee "${formData.fullName || formData.username}" created successfully`, 'success');
        setModalMode(null);
        loadData();
      } catch (err) {
        addToast(err.message || 'Failed to create employee', 'error');
      } finally {
        setSubmitting(false);
      }
    } else if (modalMode === 'approve') {
      if (!selectedEmployee) return;
      try {
        setSubmitting(true);
        await userApi.approve(selectedEmployee.id, {
          roles: formData.roles || [],
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          employeeCode: formData.employeeCode,
        });
        addToast(`Employee "${formData.fullName || selectedEmployee.username}" approved and activated successfully`, 'success');
        setModalMode(null);
        loadData();
      } catch (err) {
        addToast(err.message || 'Approval failed: ' + err.message, 'error');
      } finally {
        setSubmitting(false);
      }
    } else if (modalMode === 'edit') {
      if (!selectedEmployee) return;
      if (!canEditUser) {
        addToast('Permission denied: Only authorized staff can edit existing employee accounts.', 'error');
        return;
      }
      try {
        setSubmitting(true);
        const rolesToSave = formData.roles || [];
        if (isSuperAdminUser(selectedEmployee)) {
          if (!rolesToSave.some((r) => r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN')) {
            rolesToSave.push('ROLE_SUPER_ADMIN');
          }
        }
        await userApi.update(selectedEmployee.id, {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password || undefined,
          roles: rolesToSave,
          isActive: isSuperAdminUser(selectedEmployee) ? true : undefined,
        });
        addToast(`Employee "${formData.fullName || selectedEmployee.username}" updated`, 'success');
        setModalMode(null);
        loadData();
      } catch (err) {
        addToast(err.message || 'Failed to update employee', 'error');
      } finally {
        setSubmitting(false);
      }
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
            Employee Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Manage employee records, role assignments, and registration approvals.
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
          <Shield size={16} /> Employee Roles
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pending-approvals')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pending-approvals' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'pending-approvals' ? 700 : 500,
            color: activeTab === 'pending-approvals' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <UserCheck size={16} /> Pending Approvals
          {pendingApprovals.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'pending-approvals' ? '#0284c7' : '#f59e0b',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '9999px',
                lineHeight: 1.2,
              }}
            >
              {pendingApprovals.length}
            </span>
          )}
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
          {/* Compact Notification for Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef08a',
                borderRadius: '8px',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: '#854d0e' }}>
                <span style={{ backgroundColor: '#f59e0b', color: '#ffffff', borderRadius: '9999px', padding: '1px 8px', fontWeight: 700, fontSize: '0.75rem' }}>
                  {pendingApprovals.length}
                </span>
                <span>You have <strong>{pendingApprovals.length} pending employee registration{pendingApprovals.length > 1 ? 's' : ''}</strong> waiting for role assignment and approval.</span>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('pending-approvals')}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(2, 132, 199, 0.2)',
                }}
              >
                Review & Assign Roles &rarr;
              </button>
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

            {/* Right Controls: Status Filter, Reset, & Global Toolbar Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
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
                title="Filter by account status"
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

              {/* Global Reusable Toolbar Action Buttons (Export CSV, Print A4, Download PDF, Refresh) */}
              <ToolbarActions
                onExportCsv={handleExportCSV}
                onPrint={handlePrintEmployeeList}
                onDownloadPdf={handleDownloadEmployeeListPdf}
                onRefresh={loadData}
                loading={loading}
                exportTitle="Export employees to CSV"
                printTitle="Print Employee Directory (A4)"
                pdfTitle="Download Employee Directory PDF (A4)"
                refreshTitle="Refresh employee records"
              />
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
                            {isSuperAdminUser(emp) ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: '#16a34a',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Status: Active"
                              >
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    backgroundColor: '#16a34a',
                                    display: 'inline-block',
                                  }}
                                />
                                Active
                              </span>
                            ) : (
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
                            )}
                          </td>

                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <TableRowActions
                              onPrint={() => handlePrintEmployee(emp)}
                              onDownloadPdf={() => handleDownloadEmployeePdf(emp)}
                              onEdit={() => handleOpenEdit(emp)}
                              printTitle="Print Employee Record (A4)"
                              pdfTitle="Download Employee PDF (A4)"
                              editTitle="Edit Employee"
                            />
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
      {/* Tab: Pending Approvals & Role Assignments                      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pending-approvals' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          {/* Top Bar: Title, Search, & Toolbar Actions in ONE clean line without description */}
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
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: 700 }}>
                Pending Employee Registrations
              </h3>
              <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700 }}>
                {filteredPendingList.length} Pending
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search pending users..."
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px 0 30px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <ToolbarActions
                onExportCsv={handleExportPendingCSV}
                onPrint={handlePrintPendingList}
                onRefresh={loadData}
                loading={loading}
                exportTitle="Export pending approvals to CSV"
                printTitle="Print Pending Approvals (A4)"
                refreshTitle="Refresh pending approvals"
              />
            </div>
          </div>

          {/* Pending List or Empty State */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPendingList.length === 0 ? (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  padding: '50px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={26} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                  {pendingSearchQuery ? 'No matching pending registrations' : 'All registrations are up to date!'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '420px' }}>
                  {pendingSearchQuery
                    ? 'Try searching by a different name, username, or email.'
                    : 'There are currently no new employee registrations awaiting approval.'}
                </p>
              </div>
            ) : (
              filteredPendingList.map((pUser) => (
                <div
                  key={pUser.id}
                  onClick={() => setViewingPendingEmployee(pUser)}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    flexWrap: 'wrap',
                    transition: 'all 0.18s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
                    e.currentTarget.style.transform = 'none';
                  }}
                  title="Click to view registration details"
                >
                  {/* Left Section: Staff Profile Avatar & Info Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 520px', minWidth: '300px' }}>
                    {/* Modern Profile Avatar */}
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 3px 8px rgba(2, 132, 199, 0.28)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {(pUser.fullName || pUser.username || '?').charAt(0).toUpperCase()}
                    </div>

                    {/* Staff Profile Header & Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      {/* Name, Handle, Employee Code & Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0f172a' }}>
                          {pUser.fullName || pUser.username}
                        </span>
                        <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 500 }}>
                          @{pUser.username}
                        </span>
                        {pUser.employeeCode && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '5px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              fontFamily: 'monospace',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {pUser.employeeCode}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '9999px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={11} /> Awaiting Approval
                        </span>
                      </div>

                      {/* Staff Contact Details & Registration Info Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          flexWrap: 'wrap',
                          fontSize: '0.82rem',
                          color: '#475569',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Mail size={14} color="#0284c7" />
                          <strong style={{ color: '#1e293b', fontWeight: 600 }}>{pUser.email || '—'}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={14} color="#0284c7" />
                          <strong style={{ color: '#1e293b', fontWeight: 600 }}>{pUser.phone || '—'}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>Joined {formatJoinedDate(pUser.createdAt)}</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <Shield size={13} color={pUser.roles && pUser.roles.length > 0 ? '#0284c7' : '#94a3b8'} />
                          {pUser.roles && pUser.roles.length > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#64748b' }}>Assigned:</span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: '#0369a1',
                                  backgroundColor: '#e0f2fe',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '5px',
                                  padding: '1px 8px',
                                  fontSize: '0.76rem',
                                }}
                              >
                                {pUser.roles.map((r) => formatRoleName(typeof r === 'string' ? r : r.name)).join(', ')}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No role assigned</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Quick Approve Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestApprove(pUser);
                      }}
                      disabled={submitting}
                      style={{
                        backgroundColor: '#f0fdf4',
                        color: '#15803d',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        padding: '8px 14px',
                        borderRadius: '7px',
                        border: '1px solid #bbf7d0',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#dcfce7';
                        e.currentTarget.style.borderColor = '#86efac';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                        e.currentTarget.style.borderColor = '#bbf7d0';
                      }}
                      title="Quick approve employee registration"
                    >
                      <Check size={14} />
                      {pUser.roles && pUser.roles.length > 0
                        ? `Approve (${formatRoleName(typeof pUser.roles[0] === 'string' ? pUser.roles[0] : pUser.roles[0].name)})`
                        : 'Approve (No Role)'}
                    </button>

                    {/* Review & Assign Roles (Primary) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenApprove(pUser);
                      }}
                      disabled={submitting}
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        padding: '8px 16px',
                        borderRadius: '7px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0369a1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#0284c7';
                      }}
                    >
                      <ShieldCheck size={15} />
                      {pUser.roles && pUser.roles.length > 0 ? 'Change Role & Details' : 'Assign Roles & Approve'}
                    </button>

                    {/* Reject */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestReject(pUser);
                      }}
                      disabled={submitting}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#dc2626',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        padding: '8px 12px',
                        border: '1px solid #fecaca',
                        borderRadius: '7px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fef2f2';
                        e.currentTarget.style.borderColor = '#f87171';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#fecaca';
                      }}
                    >
                      <UserX size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Employee Roles (Matches Customer Groups structure in Customer Page) */}
      {(activeTab === 'roles' || activeTab === 'groups') && (
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
          <RolesView onRoleChange={loadData} />
        </div>
      )}

      {/* Add Employee Modal */}
      {modalMode === 'add' && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1080px',
              height: 'min(760px, 92vh)',
              maxHeight: 'min(760px, 92vh)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    Add New Employee
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Register a new staff member and assign system permissions
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Form: Left side details, Right side role assignment */}
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(330px, 0.85fr) minmax(490px, 1.4fr)',
                  gap: '20px',
                  padding: '20px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Left Side: Employee Information Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    Employee Information
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                        <label className="label">Temporary Password *</label>
                        <input
                          type="password"
                          className="input-glass"
                          required
                          placeholder="Min 6 characters"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="label">Email Address</label>
                        <input
                          type="email"
                          className="input-glass"
                          placeholder="abdul@company.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label">Phone / Contact</label>
                        <input
                          type="text"
                          className="input-glass"
                          placeholder="077xxxxxxx"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
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
                </div>

                {/* Right Side: Role Assignment Card */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                        Assign Roles & Permissions
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '1px' }}>
                        Select roles below to grant module permissions to this employee
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        color: '#0284c7',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      {(formData.roles || []).length} Assigned
                    </span>
                  </div>

                  <RoleSearchSelector
                    assignedRoles={formData.roles || []}
                    allRoles={roles}
                    onChange={(newRoles) => setFormData({ ...formData, roles: newRoles })}
                    label=""
                    formatRoleName={formatRoleName}
                    placeholder="Search roles by title, code (e.g. ROLE_SALES), or keywords..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setModalMode(null)}
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

      {/* Edit Employee Modal - Split 2-Column Layout (Matching Customer Groups style) */}
      {modalMode === 'edit' && selectedEmployee && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1080px',
              height: 'min(760px, 92vh)',
              maxHeight: 'min(760px, 92vh)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {(formData.fullName || selectedEmployee.username || 'E').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    Edit Employee: {selectedEmployee.fullName || selectedEmployee.username}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    @{selectedEmployee.username} • Update personal information and access roles
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Form: Left side details, Right side role assignment */}
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(330px, 0.85fr) minmax(490px, 1.4fr)',
                  gap: '20px',
                  padding: '20px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Left Side: Employee Information Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      Employee Profile
                    </div>
                    <span style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      ID: #{selectedEmployee.id || '—'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className="label">Full Name *</label>
                      <input
                        type="text"
                        className="input-glass"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        placeholder="e.g. John Doe"
                      />
                    </div>

                    <div>
                      <label className="label">Username</label>
                      <input
                        type="text"
                        className="input-glass"
                        disabled
                        value={formData.username}
                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                        System username cannot be modified
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="label">Email Address *</label>
                        <input
                          type="email"
                          className="input-glass"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          placeholder="email@company.com"
                        />
                      </div>
                      <div>
                        <label className="label">Phone Number</label>
                        <input
                          type="text"
                          className="input-glass"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="077xxxxxxx"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="label">Reset Password</label>
                        <input
                          type="password"
                          className="input-glass"
                          placeholder="Leave blank to keep"
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
                  </div>
                </div>

                {/* Right Side: Role Assignment Card (Splitted side-by-side like Customer Groups) */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                        Assign Roles & Permissions
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '1px' }}>
                        Select roles below to grant module permissions to this employee
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        color: '#0284c7',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      {(formData.roles || []).length} Assigned
                    </span>
                  </div>

                  <RoleSearchSelector
                    assignedRoles={formData.roles || []}
                    allRoles={roles}
                    onChange={(newRoles) => {
                      if (isSuperAdminUser(selectedEmployee) && !newRoles.some((r) => r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN')) {
                        addToast('Super Administrator role cannot be removed. Full access to all modules is permanent.', 'info');
                        newRoles = [...newRoles, 'ROLE_SUPER_ADMIN'];
                      }
                      setFormData({ ...formData, roles: newRoles });
                    }}
                    label=""
                    formatRoleName={formatRoleName}
                    placeholder="Search roles by title, code (e.g. ROLE_SALES), or keywords..."
                    isSuperAdmin={isSuperAdminUser(selectedEmployee)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setModalMode(null)}
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

      {/* Complete & Approve Modal - Split 2-Column Layout */}
      {modalMode === 'approve' && selectedEmployee && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1080px',
              height: 'min(760px, 92vh)',
              maxHeight: 'min(760px, 92vh)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    Complete & Approve Employee: {selectedEmployee.fullName || selectedEmployee.username}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    @{selectedEmployee.username} • Assign system roles and approve access to ERP
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Form: Left side details, Right side role assignment */}
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(330px, 0.85fr) minmax(490px, 1.4fr)',
                  gap: '20px',
                  padding: '20px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Left Side: Employee Information Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      Registration Details
                    </div>
                    <span style={{ fontSize: '0.72rem', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      Awaiting Approval
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className="label">Full Name</label>
                      <input
                        type="text"
                        className="input-glass"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Username</label>
                      <input
                        type="text"
                        className="input-glass"
                        disabled
                        value={formData.username}
                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                </div>

                {/* Right Side: Role Assignment Card */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                        Assign Roles & Permissions
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '1px' }}>
                        Select roles below to grant module permissions upon approval
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        color: '#0284c7',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      {(formData.roles || []).length} Assigned
                    </span>
                  </div>

                  <RoleSearchSelector
                    assignedRoles={formData.roles || []}
                    allRoles={roles}
                    onChange={(newRoles) => setFormData({ ...formData, roles: newRoles })}
                    label=""
                    formatRoleName={formatRoleName}
                    placeholder="Search roles to assign..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setModalMode(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Approving...' : 'Complete & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Awaiting Approval Card (Minimal & Nice)           */}
      {/* ------------------------------------------------------------- */}
      {viewingPendingEmployee && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  {(viewingPendingEmployee.fullName || viewingPendingEmployee.username || 'E').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                      {viewingPendingEmployee.fullName || viewingPendingEmployee.username}
                    </h2>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={11} /> Awaiting Approval
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                    @{viewingPendingEmployee.username}
                    {viewingPendingEmployee.employeeCode && ` • ${viewingPendingEmployee.employeeCode}`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPendingEmployee(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Details Box */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Email Address</span>
                <strong style={{ color: '#0f172a' }}>{viewingPendingEmployee.email || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Phone Number</span>
                <strong style={{ color: '#0f172a' }}>{viewingPendingEmployee.phone || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Registered On</span>
                <strong style={{ color: '#0f172a' }}>{formatJoinedDate(viewingPendingEmployee.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Requested Role</span>
                <strong style={{ color: '#0284c7' }}>
                  {viewingPendingEmployee.roles && viewingPendingEmployee.roles.length > 0
                    ? viewingPendingEmployee.roles.map((r) => formatRoleName(typeof r === 'string' ? r : r.name)).join(', ')
                    : 'None (Unassigned)'}
                </strong>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  const u = viewingPendingEmployee;
                  setViewingPendingEmployee(null);
                  handleRequestReject(u);
                }}
                className="btn"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  fontSize: '0.82rem',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = viewingPendingEmployee;
                  setViewingPendingEmployee(null);
                  handleOpenApprove(u);
                }}
                className="btn"
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Assign Roles & Details
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = viewingPendingEmployee;
                  setViewingPendingEmployee(null);
                  handleRequestApprove(u);
                }}
                className="btn"
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Quick Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Minimal Confirmation Popup (Approve & Reject)          */}
      {/* ------------------------------------------------------------- */}
      {confirmAction && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '430px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
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
                  borderRadius: '50%',
                  backgroundColor: confirmAction.type === 'approve' ? '#dcfce7' : '#fee2e2',
                  color: confirmAction.type === 'approve' ? '#15803d' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {confirmAction.type === 'approve' ? <UserCheck size={22} /> : <UserX size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {confirmAction.type === 'approve' ? 'Approve Registration?' : 'Reject Registration?'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                  {confirmAction.type === 'approve' ? (
                    <>
                      Confirm approval for <strong>{confirmAction.user.fullName || confirmAction.user.username}</strong> (@{confirmAction.user.username}).
                      {confirmAction.user.roles && confirmAction.user.roles.length > 0 ? (
                        <span style={{ display: 'block', marginTop: '6px', color: '#0284c7', fontWeight: 600 }}>
                          Assigned: {confirmAction.user.roles.map((r) => formatRoleName(typeof r === 'string' ? r : r.name)).join(', ')}
                        </span>
                      ) : (
                        <span style={{ display: 'block', marginTop: '6px', color: '#64748b' }}>
                          Will be approved as staff without ERP system roles.
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Are you sure you want to reject the registration request for{' '}
                      <strong>{confirmAction.user.fullName || confirmAction.user.username}</strong> (@{confirmAction.user.username})?
                      This user will not be granted access to the system.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.type === 'approve' ? executeApprove : executeReject}
                disabled={submitting}
                style={{
                  backgroundColor: confirmAction.type === 'approve' ? '#16a34a' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {submitting
                  ? 'Processing...'
                  : confirmAction.type === 'approve'
                  ? 'Confirm & Approve'
                  : 'Confirm & Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Employee Profile View Popup (When clicking row / View)  */}
      {/* ------------------------------------------------------------- */}
      {viewingEmployee && (
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
              {isSuperAdminUser(viewingEmployee) ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#0284c7',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    backgroundColor: '#f0f9ff',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <Shield size={14} /> Super Administrator (Permanent Full Access)
                </div>
              ) : (
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
              )}

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

    </div>
  );
}
