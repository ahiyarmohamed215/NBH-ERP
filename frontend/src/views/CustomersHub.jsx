import React, { useState, useEffect, useMemo } from 'react';
import {
  customerApi,
  salesmanApi,
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
} from 'lucide-react';

const STORAGE_KEY_ROUTES = 'erp_customer_routes_v1';

export default function CustomersHub({ activeSubTab = 'list', onSubTabChange }) {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(() => {
    return activeSubTab === 'groups' || activeSubTab === 'routes' ? 'groups' : 'list';
  });

  // Data states
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(false);

  // Customer List Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [routeFilter, setRouteFilter] = useState('ALL');

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

  // High-Security Deletion Modal State
  const [securityModalData, setSecurityModalData] = useState(null);
  const [securityConfirmInput, setSecurityConfirmInput] = useState('');
  const [hasCopiedPhrase, setHasCopiedPhrase] = useState(false);
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

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

  // Route Modals
  const [showCreateRouteModal, setShowCreateRouteModal] = useState(false);
  const [newRouteForm, setNewRouteForm] = useState({
    name: '',
    description: '',
    salesmanId: '',
    selectedCustomerIds: [],
  });

  const [managingRoute, setManagingRoute] = useState(null);
  const [manageForm, setManageForm] = useState({
    name: '',
    description: '',
    salesmanId: '',
    selectedCustomerIds: [],
  });
  const [customerSearchInModal, setCustomerSearchInModal] = useState('');

  // Sync subTab prop
  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(activeSubTab === 'groups' || activeSubTab === 'routes' ? 'groups' : 'list');
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

  // Initial load of customers and salesmen
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.allSettled([
        customerApi.getAll(),
        salesmanApi.getAll(),
      ]);

      let loadedCustomers = [];
      if (cRes.status === 'fulfilled') {
        loadedCustomers = cRes.value.data || [];
        setCustomers(loadedCustomers);
      }

      if (sRes.status === 'fulfilled') {
        setSalesmen(sRes.value.data || []);
      }

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

  // Helper to find which route a customer belongs to
  const getCustomerRoute = (customerId) => {
    const cid = String(customerId);
    return routes.find((r) => r.customerIds && r.customerIds.includes(cid));
  };

  const isCustomerActive = (c) => Boolean(c?.isActive ?? c?.active ?? false);

  // Filtered customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const active = isCustomerActive(c);
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'INACTIVE' && active) return false;

      const cRoute = getCustomerRoute(c.id);
      if (routeFilter !== 'ALL') {
        if (routeFilter === 'UNASSIGNED') {
          if (cRoute) return false;
        } else if (!cRoute || cRoute.id !== routeFilter) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (c.code || c.customerCode || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        const contact = (c.contactPerson || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const routeName = (cRoute?.name || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !contact.includes(q) && !phone.includes(q) && !email.includes(q) && !routeName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [customers, statusFilter, routeFilter, searchTerm, routes]);

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
      routeId: '',
    });
    setShowCustomerModal(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (c) => {
    setEditingCustomer(c);
    const assignedRoute = getCustomerRoute(c.id);
    setCustomerForm({
      code: c.code || c.customerCode || '',
      name: c.name || '',
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '0',
      routeId: assignedRoute ? assignedRoute.id : '',
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

      // Update Route assignment if selected
      if (savedCustomerId) {
        setRoutes((prevRoutes) => {
          return prevRoutes.map((r) => {
            const hasC = r.customerIds && r.customerIds.includes(savedCustomerId);
            if (r.id === customerForm.routeId) {
              if (!hasC) return { ...r, customerIds: [...(r.customerIds || []), savedCustomerId] };
            } else if (hasC) {
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
    const codeOrName = c.code || c.customerCode || c.name;
    const phrase = `DELETE ${codeOrName}`.toUpperCase();
    const assignedRoute = getCustomerRoute(c.id);

    setSecurityModalData({
      type: 'customer',
      item: c,
      requiredPhrase: phrase,
      title: `Permanently Delete Customer "${c.name}"`,
      entityName: c.name,
      entityCode: c.code || c.customerCode || '—',
      warnings: [
        `Customer record "${c.name}" (${codeOrName}) will be permanently wiped from the database.`,
        `Assigned credit limit (LKR ${Number(c.creditLimit || 0).toFixed(2)}) and outstanding balance records (LKR ${Number(c.currentBalance || 0).toFixed(2)}) will be erased.`,
        assignedRoute
          ? `Customer will be permanently detached from Route "${assignedRoute.name}".`
          : 'Any pending route assignments or delivery notes will be cleared.',
        'Historical commercial invoices, orders, and quotations linked to this customer ID will remain orphaned without an active customer profile.',
        'This action is irreversible. There is no recovery or undo for deleted customer database records.',
      ],
    });
    setSecurityConfirmInput('');
    setHasCopiedPhrase(false);
  };

  const handleInitiateDeleteRoute = (route) => {
    const phrase = `DELETE ROUTE ${route.name}`.toUpperCase();
    setSecurityModalData({
      type: 'route',
      item: route,
      title: `Permanently Delete Route "${route.name}"`,
      requiredPhrase: phrase,
      entityName: route.name,
      entityCode: route.id,
      warnings: [
        `Route "${route.name}" will be permanently removed from the system.`,
        `All ${route.customerIds?.length || 0} assigned customer(s) will become unassigned.`,
        `Salesman assignment (${route.salesmanName || 'None'}) will be disconnected.`,
        'This action is irreversible and permanently deletes the route record.',
      ],
    });
    setSecurityConfirmInput('');
    setHasCopiedPhrase(false);
  };

  const handleDeleteCustomer = (c) => {
    handleInitiateDeleteCustomer(c);
  };

  const handleCopyConfirmationPhrase = () => {
    if (!securityModalData) return;
    navigator.clipboard.writeText(securityModalData.requiredPhrase);
    setHasCopiedPhrase(true);
    addToast('Confirmation text copied to clipboard!', 'info');
    setTimeout(() => setHasCopiedPhrase(false), 2500);
  };

  const handleExecuteSecureDelete = async () => {
    if (!securityModalData) return;
    if (securityConfirmInput.trim().toUpperCase() !== securityModalData.requiredPhrase.trim().toUpperCase()) {
      addToast('Confirmation text does not match. Deletion aborted.', 'error');
      return;
    }

    try {
      setIsExecutingDelete(true);
      if (securityModalData.type === 'customer') {
        const c = securityModalData.item;
        setDeletingCustomerId(c.id);
        await customerApi.delete(c.id);
        addToast(`Customer "${c.name}" permanently deleted from database.`, 'success');
        const cid = String(c.id);
        setRoutes((prev) => prev.map((r) => ({ ...r, customerIds: (r.customerIds || []).filter((id) => id !== cid) })));
        if (viewingCustomer?.id === c.id) {
          setViewingCustomer(null);
        }
        loadInitialData();
      } else if (securityModalData.type === 'route') {
        const r = securityModalData.item;
        setRoutes((prev) => prev.filter((route) => route.id !== r.id));
        addToast(`Route "${r.name}" permanently deleted from database.`, 'success');
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
  // Route / Group Management Actions
  // -------------------------------------------------------------
  const handleOpenCreateRoute = () => {
    setNewRouteForm({
      name: '',
      description: '',
      salesmanId: '',
      selectedCustomerIds: [],
    });
    setCustomerSearchInModal('');
    setShowCreateRouteModal(true);
  };

  const handleCreateRoute = (e) => {
    e.preventDefault();
    if (!newRouteForm.name.trim()) {
      addToast('Route name is required', 'error');
      return;
    }

    const assignedSalesman = salesmen.find((s) => String(s.id) === String(newRouteForm.salesmanId));

    const newRoute = {
      id: 'route-' + Date.now(),
      name: newRouteForm.name.trim(),
      description: newRouteForm.description.trim(),
      salesmanId: newRouteForm.salesmanId || '',
      salesmanName: assignedSalesman?.name || '',
      customerIds: newRouteForm.selectedCustomerIds,
      createdAt: new Date().toISOString(),
    };

    // Remove selected customers from other routes to prevent overlap
    setRoutes((prev) => {
      const cleaned = prev.map((r) => ({
        ...r,
        customerIds: (r.customerIds || []).filter((id) => !newRoute.customerIds.includes(id)),
      }));
      return [...cleaned, newRoute];
    });

    addToast(`Route "${newRoute.name}" created with ${newRoute.customerIds.length} customers!`, 'success');
    setShowCreateRouteModal(false);
  };

  const handleOpenManageRoute = (route) => {
    setManagingRoute(route);
    setManageForm({
      name: route.name,
      description: route.description || '',
      salesmanId: route.salesmanId || '',
      selectedCustomerIds: [...(route.customerIds || [])],
    });
    setCustomerSearchInModal('');
  };

  const handleSaveManagedRoute = (e) => {
    e.preventDefault();
    if (!manageForm.name.trim()) {
      addToast('Route name is required', 'error');
      return;
    }

    const assignedSalesman = salesmen.find((s) => String(s.id) === String(manageForm.salesmanId));

    setRoutes((prev) => {
      return prev.map((r) => {
        if (r.id === managingRoute.id) {
          return {
            ...r,
            name: manageForm.name.trim(),
            description: manageForm.description.trim(),
            salesmanId: manageForm.salesmanId || '',
            salesmanName: assignedSalesman?.name || '',
            customerIds: manageForm.selectedCustomerIds,
          };
        } else {
          // Remove assigned customer ids from other routes
          return {
            ...r,
            customerIds: (r.customerIds || []).filter((id) => !manageForm.selectedCustomerIds.includes(id)),
          };
        }
      });
    });

    addToast(`Route "${manageForm.name}" updated successfully!`, 'success');
    setManagingRoute(null);
  };

  const handleDeleteRoute = (route) => {
    handleInitiateDeleteRoute(route);
  };

  // Filter customers inside modal
  const getModalFilteredCustomers = (selectedIds) => {
    return customers.filter((c) => {
      if (!customerSearchInModal.trim()) return true;
      const q = customerSearchInModal.toLowerCase();
      const code = (c.code || c.customerCode || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  };

  // Export CSV matching EmployeesHub style
  const handleExportCSV = () => {
    if (customers.length === 0) {
      addToast('No customers to export', 'error');
      return;
    }
    const headers = ['Code', 'Name', 'Route', 'Contact Person', 'Phone', 'Email', 'Credit Limit', 'Current Balance', 'Status'];
    const rows = customers.map((c) => {
      const assignedRoute = getCustomerRoute(c.id);
      return [
        `"${(c.code || c.customerCode || '').replace(/"/g, '""')}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(assignedRoute?.name || 'Unassigned').replace(/"/g, '""')}"`,
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

  const isFiltered = Boolean(searchTerm.trim() || routeFilter !== 'ALL' || statusFilter !== 'ALL');
  const handleResetFilters = () => {
    setSearchTerm('');
    setRouteFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
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
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Customers
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Create and manage customer records, credit limits, and delivery routes.
          </p>
        </div>

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
      </div>

      {/* Subtabs Bar (Underline Style matching EmployeesHub) */}
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
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Customer List View                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {/* Top Filter & Actions Bar */}
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
              {/* All Routes Filter Dropdown */}
              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 30px 0 12px',
                  width: '150px',
                  minWidth: '130px',
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
                <option value="ALL">All Routes</option>
                <option value="UNASSIGNED">Unassigned</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

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

              {/* Export CSV - Icon only matching Refresh button */}
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
                title="Export customers to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh Customer Records - Icon only */}
              <button
                type="button"
                onClick={loadInitialData}
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
                title="Refresh customer records"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Customers Table (Standardized Enterprise Table) */}
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
              }}
            >
              <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                      <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        CUSTOMER
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ROUTE / GROUP
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        CONTACT PERSON
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        PHONE NUMBER
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                        CREDIT LIMIT
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                        BALANCE
                      </th>
                      <th style={{ padding: '12px 12px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        STATUS
                      </th>
                      <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
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
                        const assignedRoute = getCustomerRoute(c.id);

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
                              {assignedRoute ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
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
                                  <MapPin size={11} /> {assignedRoute.name}
                                </span>
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
      {/* TAB 2: Customer Groups & Routes View (matching screenshot) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Container matching the screenshot */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            {/* Header row with Title, subtitle and Create Group button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Customer Groups & Routes
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                  Organize customers for targeted pricing, delivery routes, sales territories, and follow-up.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateRoute}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(2,132,199,0.2)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                <Plus size={16} /> Create Group / Route
              </button>
            </div>

            {/* Routes Cards Grid matching user screenshot */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {routes.map((route) => {
                const count = route.customerIds?.length || 0;
                const assignedSalesman = salesmen.find((s) => String(s.id) === String(route.salesmanId));
                const repName = route.salesmanName || assignedSalesman?.name;

                return (
                  <div
                    key={route.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      minHeight: '170px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                  >
                    <div>
                      {/* Card Top: Route Name & User Count Badge */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {route.name}
                        </h3>

                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #dbeafe',
                            borderRadius: '9999px',
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <Users size={12} />
                          {count}
                        </div>
                      </div>

                      {/* Description */}
                      <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 12px 0' }}>
                        {route.description || 'No description added'}
                      </p>

                      {/* Sales Representative */}
                      <p
                        style={{
                          color: repName ? '#0369a1' : '#0284c7',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          margin: '0 0 18px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <UserCheck size={14} color={repName ? '#0284c7' : '#94a3b8'} />
                        {repName ? `Sales Rep: ${repName}` : 'No sales representative assigned'}
                      </p>
                    </div>

                    {/* Card Footer: count & Manage button & delete icon matching screenshot */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                        {count} customer{count === 1 ? '' : 's'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenManageRoute(route)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '5px 12px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e2e8f0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                        >
                          <Edit2 size={13} />
                          Manage
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(route)}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#94a3b8',
                            border: 'none',
                            padding: '6px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.backgroundColor = '#fee2e2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Delete Route"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Create Group / Route */}
      {/* ------------------------------------------------------------- */}
      {showCreateRouteModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateRouteModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '800px',
              padding: '28px 32px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Create Customer Group / Route</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>Define delivery routes and territorial customer clusters</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateRouteModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Route / Group Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Route 1, City North, Wholesale Supermarkets"
                    value={newRouteForm.name}
                    onChange={(e) => setNewRouteForm({ ...newRouteForm, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Assigned Sales Representative (Optional)
                  </label>
                  <select
                    value={newRouteForm.salesmanId}
                    onChange={(e) => setNewRouteForm({ ...newRouteForm, salesmanId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="">No sales representative assigned</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.salesmanCode || 'Sales Rep'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly delivery route covered on Tuesdays"
                  value={newRouteForm.description}
                  onChange={(e) => setNewRouteForm({ ...newRouteForm, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Assign Customers Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                    Assign Customers to this Route ({newRouteForm.selectedCustomerIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (newRouteForm.selectedCustomerIds.length === customers.length) {
                        setNewRouteForm({ ...newRouteForm, selectedCustomerIds: [] });
                      } else {
                        setNewRouteForm({ ...newRouteForm, selectedCustomerIds: customers.map((c) => String(c.id)) });
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {newRouteForm.selectedCustomerIds.length === customers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search customers to add..."
                    value={customerSearchInModal}
                    onChange={(e) => setCustomerSearchInModal(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '240px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '8px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {getModalFilteredCustomers(newRouteForm.selectedCustomerIds).map((c) => {
                    const cid = String(c.id);
                    const isChecked = newRouteForm.selectedCustomerIds.includes(cid);
                    const otherRoute = getCustomerRoute(c.id);

                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                          border: isChecked ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRouteForm({
                                  ...newRouteForm,
                                  selectedCustomerIds: [...newRouteForm.selectedCustomerIds, cid],
                                });
                              } else {
                                setNewRouteForm({
                                  ...newRouteForm,
                                  selectedCustomerIds: newRouteForm.selectedCustomerIds.filter((id) => id !== cid),
                                });
                              }
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                            ({c.code || c.customerCode || 'NO CODE'})
                          </span>
                        </div>

                        {otherRoute && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px', whiteSpace: 'nowrap' }}>
                            in {otherRoute.name}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateRouteModal(false)}
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
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.2)',
                  }}
                >
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Manage Route / Group */}
      {/* ------------------------------------------------------------- */}
      {managingRoute && (
        <div className="modal-backdrop" onClick={() => setManagingRoute(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '840px',
              padding: '28px 32px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Manage {managingRoute.name}</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>Update delivery route details and assigned customers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingRoute(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveManagedRoute} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Route / Group Name *
                  </label>
                  <input
                    type="text"
                    value={manageForm.name}
                    onChange={(e) => setManageForm({ ...manageForm, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Assigned Sales Representative
                  </label>
                  <select
                    value={manageForm.salesmanId}
                    onChange={(e) => setManageForm({ ...manageForm, salesmanId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="">No sales representative assigned</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.salesmanCode || 'Sales Rep'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={manageForm.description}
                  onChange={(e) => setManageForm({ ...manageForm, description: e.target.value })}
                  placeholder="e.g. Weekly delivery route covered on Tuesdays"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Customer Checkboxes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                    Assigned Customers ({manageForm.selectedCustomerIds.length} in this route)
                  </label>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Check or uncheck to update customer route membership
                  </span>
                </div>

                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearchInModal}
                    onChange={(e) => setCustomerSearchInModal(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '8px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {getModalFilteredCustomers(manageForm.selectedCustomerIds).map((c) => {
                    const cid = String(c.id);
                    const isChecked = manageForm.selectedCustomerIds.includes(cid);
                    const otherRoute = getCustomerRoute(c.id);
                    const isOther = otherRoute && otherRoute.id !== managingRoute.id;

                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                          border: isChecked ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setManageForm({
                                  ...manageForm,
                                  selectedCustomerIds: [...manageForm.selectedCustomerIds, cid],
                                });
                              } else {
                                setManageForm({
                                  ...manageForm,
                                  selectedCustomerIds: manageForm.selectedCustomerIds.filter((id) => id !== cid),
                                });
                              }
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                            ({c.code || c.customerCode || 'NO CODE'})
                          </span>
                        </div>

                        {isOther && (
                          <span style={{ fontSize: '0.72rem', color: '#d97706', marginLeft: '6px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            in {otherRoute.name}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setManagingRoute(null)}
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
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.2)',
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
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
              maxWidth: '840px',
              padding: '28px 32px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
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
                alignItems: 'flex-start',
                paddingBottom: '18px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '20px',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  {(viewingCustomer.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                      {viewingCustomer.name}
                    </h2>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        backgroundColor: '#f1f5f9',
                        color: '#0284c7',
                        padding: '3px 8px',
                        borderRadius: '5px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {viewingCustomer.code || viewingCustomer.customerCode || 'NO CODE'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '9999px',
                        backgroundColor: isCustomerActive(viewingCustomer) ? '#dcfce7' : '#fee2e2',
                        color: isCustomerActive(viewingCustomer) ? '#15803d' : '#b91c1c',
                        border: `1px solid ${isCustomerActive(viewingCustomer) ? '#bbf7d0' : '#fecaca'}`,
                      }}
                    >
                      {isCustomerActive(viewingCustomer) ? '● Active' : '● Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#0284c7" />
                    Route: <strong style={{ color: '#334155' }}>{getCustomerRoute(viewingCustomer.id)?.name || 'Unassigned'}</strong>
                    {getCustomerRoute(viewingCustomer.id)?.salesmanName && (
                      <>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span>Sales Rep: {getCustomerRoute(viewingCustomer.id).salesmanName}</span>
                      </>
                    )}
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
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
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
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
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
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close Profile Popup"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Profile Details Cards in Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '22px' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={15} color="#0284c7" /> Contact Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Contact Person</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingCustomer.contactPerson || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Phone Number</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingCustomer.phone || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Email Address</span>
                    <span style={{ fontWeight: 500, color: '#0f172a' }}>{viewingCustomer.email || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Physical Address</span>
                    <span style={{ fontWeight: 500, color: '#334155' }}>{viewingCustomer.address || '—'}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} color="#16a34a" /> Financial & Credit Terms
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Approved Credit Limit</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.98rem', fontFamily: 'monospace' }}>
                      LKR {Number(viewingCustomer.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Current Balance</span>
                    <span style={{ fontWeight: 700, color: Number(viewingCustomer.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a', fontSize: '0.98rem', fontFamily: 'monospace' }}>
                      LKR {Number(viewingCustomer.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Credit Status</span>
                    <span style={{ fontWeight: 600, color: Number(viewingCustomer.currentBalance || 0) > Number(viewingCustomer.creditLimit || 0) ? '#dc2626' : '#16a34a' }}>
                      {Number(viewingCustomer.currentBalance || 0) > Number(viewingCustomer.creditLimit || 0) ? '⚠ Credit Limit Exceeded' : '✓ Within Approved Limit'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} color="#d97706" /> Route & Logistics
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Assigned Route</span>
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>
                      {getCustomerRoute(viewingCustomer.id)?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Sales Representative</span>
                    <span style={{ fontWeight: 500, color: '#0f172a' }}>
                      {getCustomerRoute(viewingCustomer.id)?.salesmanName || 'None assigned'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Customer ID Reference</span>
                    <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                      {viewingCustomer.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: '0.86rem',
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
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Enter customer directory details and route assignments
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

              {/* Route Assignment & Contact Person */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Delivery Route / Customer Group
                  </label>
                  <select
                    value={customerForm.routeId}
                    onChange={(e) => setCustomerForm({ ...customerForm, routeId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="">Unassigned (No specific route)</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>

              {/* Phone & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
              </div>

              {/* Credit Limit & Address */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.2)',
                  }}
                >
                  {savingCustomer ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ------------------------------------------------------------- */}
      {/* HIGH-SECURITY DELETION CONFIRMATION MODAL */}
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
              maxWidth: '540px',
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              border: '2px solid #ef4444',
              boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Security Alert Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid #fecaca',
                }}
              >
                <ShieldAlert size={26} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    CRITICAL ACTION
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    Permanent Database Removal
                  </span>
                </div>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                  {securityModalData.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isExecutingDelete && setSecurityModalData(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Consequence Warning Box: Detailed Explanation */}
            <div
              style={{
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9f1239', fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px' }}>
                <AlertTriangle size={16} />
                <span>What will happen upon deletion:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#881337', fontSize: '0.82rem', lineHeight: '1.6' }}>
                {securityModalData.warnings.map((w, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Copy-Paste Confirmation Phrase Box */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Required Confirmation Phrase:
                </label>
                <button
                  type="button"
                  onClick={handleCopyConfirmationPhrase}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: hasCopiedPhrase ? '#dcfce7' : '#f1f5f9',
                    color: hasCopiedPhrase ? '#15803d' : '#475569',
                    border: '1px solid',
                    borderColor: hasCopiedPhrase ? '#86efac' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {hasCopiedPhrase ? <Check size={13} /> : <Copy size={13} />}
                  {hasCopiedPhrase ? 'Copied to Clipboard!' : 'Copy Phrase'}
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  padding: '11px 14px',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  letterSpacing: '0.04em',
                  userSelect: 'all',
                  border: '1px solid #1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{securityModalData.requiredPhrase}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>click button to copy</span>
              </div>
            </div>

            {/* Input to Type or Paste Phrase */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Type or paste the exact confirmation phrase below:
              </label>
              <input
                type="text"
                autoFocus
                placeholder={`Type or paste "${securityModalData.requiredPhrase}"`}
                value={securityConfirmInput}
                onChange={(e) => setSecurityConfirmInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor:
                    securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                      ? '#16a34a'
                      : '#cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  fontFamily: 'monospace',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  fontSize: '0.75rem',
                  marginTop: '6px',
                  fontWeight: 600,
                  color:
                    securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                      ? '#16a34a'
                      : '#94a3b8',
                }}
              >
                {securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                  ? '✓ Confirmation phrase matches. You may now execute permanent deletion.'
                  : 'Enter the exact confirmation phrase to enable the delete button.'}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-glass"
                disabled={isExecutingDelete}
                onClick={() => setSecurityModalData(null)}
                style={{ padding: '8px 18px', fontSize: '0.86rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  securityConfirmInput.trim().toUpperCase() !== securityModalData.requiredPhrase.trim().toUpperCase() ||
                  isExecutingDelete
                }
                onClick={handleExecuteSecureDelete}
                style={{
                  backgroundColor:
                    securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                      ? '#dc2626'
                      : '#fca5a5',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor:
                    securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                      ? 'pointer'
                      : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow:
                    securityConfirmInput.trim().toUpperCase() === securityModalData.requiredPhrase.trim().toUpperCase()
                      ? '0 2px 6px rgba(220, 38, 38, 0.35)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={16} />
                {isExecutingDelete ? 'Deleting from Database...' : 'Permanently Delete from Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
