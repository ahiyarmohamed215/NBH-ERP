import {hasPermission} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import StatusBadge from '../components/StatusBadge';
import {staffCode} from '../utils/staffCode';
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
import useRecordDeletion from '../hooks/useRecordDeletion';
import SearchBar from '../components/SearchBar';
import FilterSelect from '../components/FilterSelect';
import EmployeeDetailsModal from '../components/EmployeeDetailsModal';
import EmployeeEditorModal from '../components/EmployeeEditorModal';
import './EmployeeDialogs.css';
import { Plus, Search, Edit2, CheckCircle, X, Phone, Mail, Shield, ShieldCheck, Clock, ListFilter, Check, UserCheck, UserX, Info, Trash2, Printer, RefreshCw, KeyRound } from 'lucide-react';

export default function EmployeesHub({ activeSubTab, onSubTabChange }) {
  const { user: currentUser } = useAuth();
  const canEditUser = canEditModule(currentUser, 'USER');
  const { addToast } = useToast();
  const employeeDeletion=useRecordDeletion('USER','Employee',()=>loadData());

  const isSuperAdminUser = (emp) => {
    if (!emp) return false;
    const rList = emp.roles || [];
    return rList.some((r) => {
      const name = typeof r === 'string' ? r : r?.name;
      return name === 'ROLE_SUPER_ADMIN' || name === 'SUPER_ADMIN';
    });
  };

  // Old links to unfinished modules fall back to the employee list.
  const resolveTab = tab => {
    if (tab === 'roles') return 'roles';
    if (tab === 'pending-approvals' || tab === 'approvals') return 'pending-approvals';
    return 'list';
  };
  const [activeTab, setActiveTab] = useModuleTab('employees',resolveTab(activeSubTab),'list',currentUser);

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
        hasPermission(currentUser,'USER_VIEW') ? userApi.getAll({ page: 0, size: 200 }) : Promise.resolve({data:[]}),
        userApi.getPending({ page: 0, size: 50 }).catch(()=>({data:[]})),
        roleApi.getAll().catch(()=>({data:[]})),
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

  const employeeStatus = (emp) => {
    if (!emp) return 'INACTIVE';
    if (emp.status) return emp.status.toUpperCase();
    if (emp.approvalStatus && emp.approvalStatus.toUpperCase() === 'PENDING') return 'DRAFT';
    if (emp.approvalStatus && emp.approvalStatus.toUpperCase() === 'DRAFT') return 'DRAFT';
    return emp.isActive ? 'ACTIVE' : 'INACTIVE';
  };

  const employeeActionStyle = {
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
    transition: 'all 0.15s ease',
  };

  const toolbarBtnStyle = {
    height: '38px',
    width: '38px',
    minWidth: '38px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    color: '#334155',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    boxShadow: 'none',
    transition: 'all 0.15s ease',
    padding: 0,
    outline: 'none',
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const status = employeeStatus(emp);
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;

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
      return nameMatch || userMatch || emailMatch || phoneMatch || roleMatch || staffCode(emp).toLowerCase().includes(q);
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
          { label: 'Code', value: staffCode(emp) },
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
        { header: 'Staff code', accessor: (u) => staffCode(u) },
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
        });
        const resetNoted = selectedEmployee.passwordResetRequested && formData.password;
        addToast(
          resetNoted
            ? `Employee "${formData.fullName || selectedEmployee.username}" password updated. Reset request resolved and credentials sent to ${formData.email || selectedEmployee.email}.`
            : `Employee "${formData.fullName || selectedEmployee.username}" updated`,
          'success'
        );
        setModalMode(null);
        loadData();
      } catch (err) {
        addToast(err.message || 'Failed to update employee', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSaveEmployee = async (event, draftStatus) => {
    if (event) event.preventDefault();
    if (submitting) return;

    const isDraft = draftStatus === 'DRAFT';
    if (modalMode === 'add') {
      try {
        setSubmitting(true);
        const rolesToSave = formData.roles && formData.roles.length > 0 ? formData.roles : ['ROLE_STAFF'];
        const res = await userApi.create({
          username: formData.username || `draft_${Date.now()}`,
          fullName: formData.fullName || 'Draft Employee',
          email: formData.email || `draft_${Date.now()}@example.com`,
          phone: formData.phone || '',
          password: formData.password || 'Temporary123!',
          roles: rolesToSave,
        });
        const createdUser = res.data?.data || res.data;
        if (isDraft && createdUser?.id) {
          try { await userApi.toggleActive(createdUser.id); } catch {}
        }
        addToast(isDraft ? 'Employee draft saved' : `Employee "${formData.fullName || formData.username}" created successfully`, 'success');
        setModalMode(null);
        setSelectedEmployee(null);
        await loadData();
      } catch (err) {
        addToast(err.response?.data?.message || err.message || 'Failed to create employee', 'error');
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
        });
        addToast(`Employee "${formData.fullName || selectedEmployee.username}" updated`, 'success');
        setModalMode(null);
        setSelectedEmployee(null);
        await loadData();
      } catch (err) {
        addToast(err.response?.data?.message || err.message || 'Failed to update employee', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleEmployeeStatus = async (employee, target) => {
    if (!canEditUser || isSuperAdminUser(employee)) return;
    try {
      setSubmitting(true);
      if (target === 'ACTIVE') {
        if (employee.approvalStatus === 'PENDING' || employee.status === 'DRAFT') {
          await userApi.approve(employee.id, { roles: employee.roles || ['ROLE_STAFF'] });
        } else if (!employee.isActive) {
          await userApi.toggleActive(employee.id);
        }
      } else if (target === 'INACTIVE' && employee.isActive) {
        await userApi.toggleActive(employee.id);
      }
      setViewingEmployee((prev) =>
        prev && prev.id === employee.id
          ? {
              ...prev,
              isActive: target === 'ACTIVE',
              status: target,
              approvalStatus: target === 'ACTIVE' ? 'APPROVED' : prev.approvalStatus,
            }
          : prev
      );
      await loadData();
      addToast(`Employee status updated to ${target.toLowerCase()}`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to update employee status', 'error');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className={`erp-page${modalMode === 'add' || modalMode === 'edit' ? ' inventory-allocation-focus' : ''}`}
      style={{
        padding: (modalMode === 'add' || modalMode === 'edit') ? '12px' : '24px 32px',
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
      {(modalMode === 'add' || modalMode === 'edit') ? (
        <EmployeeEditorModal
          form={formData}
          setForm={setFormData}
          editing={modalMode === 'edit'}
          selectedEmployee={selectedEmployee}
          saving={submitting}
          roles={roles}
          onClose={() => {
            setModalMode(null);
            setSelectedEmployee(null);
          }}
          onSubmit={handleSaveEmployee}
        />
      ) : (
        <>
          {/* Page Header (Fixed / Sticky at Top) */}
      <div className="erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="erp-page-title">
            Employee Management
          </h1>
          <p className="erp-page-description">
            Manage employee records, role assignments, and registration approvals.
          </p>
        </div>

        <button disabled={!hasPermission(currentUser,'USER_MANAGE')}
          type="button"
          onClick={handleOpenAdd}
          className="btn btn-primary erp-button erp-button-primary"
          style={{
            padding: '9px 18px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <Plus size={17} /> New Employee
        </button>
      </div>

      {/* Subtabs Bar (Underline Style - Fixed / Sticky at Top) */}
      <ErpTabs module="employees"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        <ErpTab tabId="list" data-active={activeTab === 'list'} aria-pressed={activeTab === 'list'}
          type="button"
          onClick={() => handleTabChange('list')}

        >
          <ListFilter size={16} /> Employee List
        </ErpTab>

        <ErpTab tabId="roles" data-active={activeTab === 'roles' || activeTab === 'groups'} aria-pressed={activeTab === 'roles' || activeTab === 'groups'}
          type="button"
          onClick={() => handleTabChange('roles')}

        >
          <Shield size={16} /> Employee Roles
        </ErpTab>

        <ErpTab tabId="pending-approvals" data-active={activeTab === 'pending-approvals'} aria-pressed={activeTab === 'pending-approvals'}
          type="button"
          onClick={() => handleTabChange('pending-approvals')}

        >
          <UserCheck size={16} /> Pending Approvals
          {pendingApprovals.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'pending-approvals' ? '#0284c7' : '#f59e0b',
                color: '#ffffff',
                fontSize: 'var(--erp-text-caption)',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '9999px',
                lineHeight: 1.2,
              }}
            >
              {pendingApprovals.length}
            </span>
          )}
        </ErpTab>

      </ErpTabs>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--erp-text-button)', color: '#854d0e' }}>
                <span style={{ backgroundColor: '#f59e0b', color: '#ffffff', borderRadius: '9999px', padding: '1px 8px', fontWeight: 700, fontSize: 'var(--erp-text-caption)' }}>
                  {pendingApprovals.length}
                </span>
                <span>You have <strong>{pendingApprovals.length} pending employee registration{pendingApprovals.length > 1 ? 's' : ''}</strong> waiting for role assignment and approval.</span>
              </div>
              <button className="erp-button erp-button-primary"
                type="button"
                onClick={() => handleTabChange('pending-approvals')}
                style={{
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Review & Assign Roles &rarr;
              </button>
            </div>
          )}

          {/* Search Bar & Action Buttons (Standardized Supplier Theme) */}
          <div
            className="master-toolbar"
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
            {/* Left Control: Reusable SearchBar with blue focus border */}
            <div style={{ flex: 1, minWidth: '240px' }}>
              <SearchBar
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search employees by name, staff code, email, phone or role..."
                ariaLabel="Search employees"
              />
            </div>

            {/* Right Controls: Status Filter (with Draft), Reset, Print & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <FilterSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '140px' }}
                title="Filter records by status"
                ariaLabel="Filter records by status"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </FilterSelect>

              {(statusFilter !== 'ALL' || searchQuery) && (
                <button
                  className="erp-button"
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchQuery('');
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
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintEmployeeList}
                style={toolbarBtnStyle}
                title="Print Employee Directory (A4)"
                aria-label="Print Employee Directory (A4)"
              >
                <Printer size={15} />
              </button>

              <button
                type="button"
                onClick={loadData}
                style={toolbarBtnStyle}
                title="Refresh employee records"
                aria-label="Refresh employee records"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Employees Table (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      EMPLOYEE CODE
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      EMPLOYEE NAME
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ROLE
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      PHONE / EMAIL
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      JOINED
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>
                        Loading employee records...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>
                        No employees found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const primaryRole = getPrimaryRole(emp);
                      const status = employeeStatus(emp);
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
                          <td className="erp-table-cell" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {staffCode(emp)}
                          </td>

                          <td className="erp-table-cell">
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                {emp.fullName || emp.username}
                              </div>
                              <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                                @{emp.username}
                              </div>
                            </div>
                          </td>

                          <td className="erp-table-cell" style={{ color: '#334155', fontWeight: 500 }}>
                            {primaryRole}
                          </td>

                          <td className="erp-table-cell" style={{ color: '#475569' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '240px' }}>
                              {emp.phone && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--erp-text-body)', fontWeight: 500 }}>
                                  <Phone size={12} aria-hidden="true" style={{ color: '#94a3b8', flexShrink: 0 }} />
                                  {emp.phone}
                                </span>
                              )}
                              {emp.email && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
                                  <Mail size={12} aria-hidden="true" style={{ color: '#94a3b8', flexShrink: 0 }} />
                                  <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{emp.email}</span>
                                </span>
                              )}
                              {!emp.phone && !emp.email && '—'}
                            </div>
                          </td>

                          <td className="erp-table-cell" style={{ color: '#64748b' }}>
                            {formatJoinedDate(emp.createdAt)}
                          </td>

                          <td className="erp-table-cell">
                            <StatusBadge
                              status={status}
                              title={`Status: ${status}`}
                            />
                            {emp.passwordResetRequested && (
                              <div style={{ marginTop: '4px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '4px',
                                    color: '#b45309',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                  }}
                                  title={emp.passwordResetNotes ? `Reset Requested: ${emp.passwordResetNotes}` : 'Password reset requested by user'}
                                >
                                  <KeyRound size={11} /> Reset Requested
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="erp-table-icon-action"
                                type="button"
                                title="Edit Employee"
                                aria-label="Edit Employee"
                                disabled={!canEditUser || isSuperAdminUser(emp)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenEdit(emp);
                                }}
                                style={employeeActionStyle}
                                onMouseEnter={(event) => {
                                  event.currentTarget.style.backgroundColor = '#f0f9ff';
                                }}
                                onMouseLeave={(event) => {
                                  event.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="erp-table-icon-action"
                                type="button"
                                title="Print Employee Profile (A4)"
                                aria-label="Print Employee Profile (A4)"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePrintEmployee(emp);
                                }}
                                style={employeeActionStyle}
                                onMouseEnter={(event) => {
                                  event.currentTarget.style.backgroundColor = '#f0f9ff';
                                }}
                                onMouseLeave={(event) => {
                                  event.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <Printer size={13} />
                              </button>
                              {canEditUser && !isSuperAdminUser(emp) && String(emp.id) !== String(currentUser?.id) && (
                                <button
                                  className="erp-table-icon-action"
                                  data-tone="danger"
                                  type="button"
                                  title="Delete Employee"
                                  aria-label="Delete Employee"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    employeeDeletion.requestDeletion(emp);
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
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
              <h3 style={{ margin: 0, fontSize: 'var(--erp-text-nav)', color: '#0f172a', fontWeight: 700 }}>
                Pending Employee Registrations
              </h3>
              <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 8px', borderRadius: '9999px', fontSize: 'var(--erp-text-caption)', fontWeight: 700 }}>
                {filteredPendingList.length} Pending
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input className="erp-field"
                  type="text"
                  placeholder="Search pending users..."
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px 0 30px',
                    border: '1px solid #cbd5e1',
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
                <h4 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a', fontWeight: 700 }}>
                  {pendingSearchQuery ? 'No matching pending registrations' : 'All registrations are up to date!'}
                </h4>
                <p style={{ margin: 0, fontSize: 'var(--erp-text-body)', color: '#64748b', maxWidth: '420px' }}>
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
                        fontSize: 'var(--erp-text-dialog)',
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
                        <span style={{ fontWeight: 800, fontSize: 'var(--erp-text-section)', color: '#0f172a' }}>
                          {pUser.fullName || pUser.username}
                        </span>
                        <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 500 }}>
                          @{pUser.username}
                        </span>
                        {pUser.id != null && (
                          <span
                            style={{
                              fontSize: 'var(--erp-text-caption)',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '5px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              fontFamily: 'monospace',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {staffCode(pUser)}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 'var(--erp-text-caption)',
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
                          fontSize: 'var(--erp-text-body)',
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
                        {pUser.roles && pUser.roles.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Shield size={13} color="#0284c7" />
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
                                  fontSize: 'var(--erp-text-caption)',
                                }}
                              >
                                {pUser.roles.map((r) => formatRoleName(typeof r === 'string' ? r : r.name)).join(', ')}
                              </span>
                            </span>
                          </span>
                        )}
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
                        fontSize: 'var(--erp-text-body)',
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
                        : 'Quick Approve'}
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
                        fontSize: 'var(--erp-text-body)',
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
                    <button className="erp-button"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestReject(pUser);
                      }}
                      disabled={submitting}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#dc2626',
                        padding: '8px 12px',
                        border: '1px solid #fecaca',
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
        </>
      )}

      {/* Complete & Approve Modal - Split 2-Column Layout */}
      {modalMode === 'approve' && selectedEmployee && (
        <div
          className="modal-backdrop"
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto', backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
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
                    fontSize: 'var(--erp-text-section)',
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                    Complete & Approve Employee: {selectedEmployee.fullName || selectedEmployee.username}
                  </h2>
                  <div style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', marginTop: '2px' }}>
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
                    <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-nav)', color: '#0f172a' }}>
                      Registration Details
                    </div>
                    <span style={{ fontSize: 'var(--erp-text-caption)', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      Awaiting Approval
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div><label className="label">Staff code</label><input type="text" className="input-glass erp-field" aria-label="Staff code" readOnly value={staffCode(selectedEmployee)}/></div>
                    <div>
                      <label className="label">Full Name</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Username</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
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
                          className="input-glass erp-field"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label">Phone Number</label>
                        <input
                          type="text"
                          className="input-glass erp-field"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Employee Type</label>
                      <select
                        className="input-glass erp-field"
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
                      <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-nav)', color: '#0f172a' }}>
                        Assign Roles & Permissions
                      </div>
                      <div style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', marginTop: '1px' }}>
                        Select roles below to grant module permissions upon approval
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 'var(--erp-text-caption)',
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
                  className="btn btn-glass erp-button"
                  onClick={() => setModalMode(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary erp-button"
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
          style={{ padding: '16px', zIndex: 1100, overflowY: 'auto', backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
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
                    fontSize: 'var(--erp-text-dialog)',
                    flexShrink: 0,
                  }}
                >
                  {(viewingPendingEmployee.fullName || viewingPendingEmployee.username || 'E').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                      {viewingPendingEmployee.fullName || viewingPendingEmployee.username}
                    </h2>
                    <span
                      style={{
                        fontSize: 'var(--erp-text-caption)',
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
                  <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '2px' }}>
                    @{viewingPendingEmployee.username}
                    {` • ${staffCode(viewingPendingEmployee)}`}
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
                fontSize: 'var(--erp-text-field)',
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontSize: 'var(--erp-text-caption)', display: 'block' }}>Email Address</span>
                <strong style={{ color: '#0f172a' }}>{viewingPendingEmployee.email || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: 'var(--erp-text-caption)', display: 'block' }}>Phone Number</span>
                <strong style={{ color: '#0f172a' }}>{viewingPendingEmployee.phone || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: 'var(--erp-text-caption)', display: 'block' }}>Registered On</span>
                <strong style={{ color: '#0f172a' }}>{formatJoinedDate(viewingPendingEmployee.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: 'var(--erp-text-caption)', display: 'block' }}>Requested Role</span>
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
                className="btn erp-button"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '7px 14px',
                  cursor: 'pointer',
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
                className="btn erp-button erp-button-primary"
                style={{
                  padding: '7px 16px',
                  cursor: 'pointer',
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
                className="btn erp-button"
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  cursor: 'pointer',
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
          style={{ padding: '16px', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
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
                <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                  {confirmAction.type === 'approve' ? 'Approve Registration?' : 'Reject Registration?'}
                </h3>
                <p style={{ margin: 0, fontSize: 'var(--erp-text-field)', color: '#475569', lineHeight: 1.5 }}>
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
                className="btn btn-glass erp-button"
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
                  fontSize: 'var(--erp-text-body)',
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
      {/* Employee Details Modal (Supplier Theme) */}
      {viewingEmployee && (
        <EmployeeDetailsModal
          employee={viewingEmployee}
          currentUser={currentUser}
          canManage={canEditUser}
          isSuperAdmin={isSuperAdminUser(viewingEmployee)}
          onClose={() => setViewingEmployee(null)}
          onPrint={() => handlePrintEmployee(viewingEmployee)}
          onEdit={() => {
            const emp = viewingEmployee;
            setViewingEmployee(null);
            handleOpenEdit(emp);
          }}
          onStatusChange={(target) => handleEmployeeStatus(viewingEmployee, target)}
          onDelete={() => {
            const emp = viewingEmployee;
            setViewingEmployee(null);
            employeeDeletion.requestDeletion(emp);
          }}
        />
      )}

      {employeeDeletion.deletionDialog}
    </div>
  );
}
