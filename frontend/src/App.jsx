import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import LoginView from './views/LoginView';
import SignupView from './views/SignupView';
import DashboardView from './views/DashboardView';
import InventoryHub from './views/InventoryHub';
import PurchasingHub from './views/PurchasingHub';
import InvoicingHub from './views/InvoicingHub';
import EmployeesHub from './views/EmployeesHub';
import MastersView from './views/MastersView';
import ReportsView from './views/ReportsView';
import AccountingHub from './views/AccountingHub';
import CustomersHub from './views/CustomersHub';
import DeliveryHub from './views/DeliveryHub';
import SidebarProfile from './components/SidebarProfile';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import useErpShortcuts from './hooks/useErpShortcuts';

import {
  LayoutDashboard,
  BookOpen,
  Users,
  Contact,
  Boxes,
  Truck,
  FileText,
  BarChart3,
  Package,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// Reusable coming-soon component for emerging ERP modules
function ComingSoonModule({ title, description, icon: Icon, color = '#2563eb', bg = '#eff6ff' }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '540px', margin: '0 auto' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: bg,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px auto',
        }}
      >
        <Icon size={30} />
      </div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
        {title}
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '20px' }}>
        {description}
      </p>
      <span
        style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: color,
          backgroundColor: bg,
          padding: '5px 14px',
          borderRadius: '9999px',
          letterSpacing: '0.04em',
          border: `1px solid ${color}30`,
        }}
      >
        MODULE COMING SOON
      </span>
    </div>
  );
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [currentView, setCurrentView] = useState(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    return p.get('view') || 'dashboard';
  });
  const [subTab, setSubTab] = useState(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const initialView = p.get('view') || 'dashboard';
    return initialView === 'dashboard' ? '' : (p.get('tab') || '');
  });

  useEffect(() => {
    if (currentView === 'dashboard') {
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }

    const params = new URLSearchParams();
    if (currentView) params.set('view', currentView);
    if (subTab) params.set('tab', subTab);

    const hashString = params.toString() ? `#${params.toString()}` : '';
    if (window.location.hash !== hashString) {
      history.replaceState(null, '', window.location.pathname + window.location.search + hashString);
    }
  }, [currentView, subTab]);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.hash.slice(1));
      const nextView = p.get('view') || 'dashboard';
      setCurrentView(nextView);
      setSubTab(nextView === 'dashboard' ? '' : (p.get('tab') || ''));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Automatic purge of legacy localStorage mock caches
  useEffect(() => {
    const LEGACY_STORAGE_KEYS = [
      'erp_commercial_invoices_v1',
      'erp_customer_routes_v1',
      'erp_quotations_v1',
      'erp_sales_orders_v1',
      'erp_customer_payments_v1',
      'erp_advance_payments_v1',
      'erp_customer_cheques_v1',
      'erp_held_bills_workflow_v1',
      'erp_deleted_held_bills_v1',
      'erp_purchase_orders_v1',
    ];
    LEGACY_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) { }
    });
  }, []);

  // Fullscreen & Distraction-Free States
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isSuperAdmin = Boolean(
    user?.roles?.includes('ROLE_SUPER_ADMIN') ||
    user?.roles?.includes('ROLE_ADMIN') ||
    (Array.isArray(user?.roles) && user.roles.some((r) => typeof r === 'string' && (r === 'ROLE_ADMIN' || r === 'ROLE_SUPER_ADMIN')))
  );
  const userPermissions = user?.permissions || [];

  // Primary module definitions ordered matching user mockup
  const moduleDefinitions = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permissions: ['DASHBOARD_VIEW'],
      },
      {
        id: 'invoicing',
        label: 'Sales',
        icon: FileText,
        permissions: ['SALES_CREATE', 'SALES_VIEW', 'SALES_VIEW_ALL', 'SALES_RETURN','PAYMENT_VIEW','PAYMENT_CREATE','QUOTATION_VIEW'],
        subItems: [
          { id: 'sales', label: 'Sales Invoices', permission: 'SALES_VIEW' },
          { id: 'hold-bills', label: 'Hold Bills', permission: 'SALES_CREATE' },
          { id: 'refunds', label: 'Sales Returns', permission: 'SALES_RETURN' },
          { id: 'payments', label: 'Payments', permission: 'PAYMENT_VIEW' },
          { id: 'advance-payments', label: 'Advance Payments', permission: 'PAYMENT_VIEW' },
          { id: 'outstanding-payments', label: 'Outstanding Payments', permission: 'SALES_CREATE' },
          { id: 'quotations', label: 'Quotations', permission: 'QUOTATION_VIEW' },
        ],
      },
      {
        id: 'customers',
        label: 'Customers',
        icon: Users,
        permissions: ['CUSTOMER_MANAGE'],
        subItems: [
          { id: 'list', label: 'Customer List', permission: 'CUSTOMER_MANAGE' },
          { id: 'groups', label: 'Customer Groups', permission: 'CUSTOMER_MANAGE' },
          { id: 'history', label: 'Customer History', permission: 'CUSTOMER_MANAGE' },
        ],
      },
      {
        id: 'employees',
        label: 'Employees',
        icon: Contact,
        permissions: ['USER_MANAGE', 'ROLE_MANAGE'],
        subItems: [
          { id: 'list', label: 'Employee List', permission: 'USER_MANAGE' },
          { id: 'pending-approvals', label: 'Pending Approvals & Roles', permission: 'USER_MANAGE' },
          { id: 'roles', label: 'Roles', permission: 'ROLE_MANAGE' },
          { id: 'targets', label: 'Sales Targets', permission: 'USER_MANAGE' },
          { id: 'attendance', label: 'Attendance', permission: 'USER_MANAGE' },
          { id: 'payroll', label: 'Payroll', permission: 'USER_MANAGE' },
          { id: 'commissions', label: 'Commission Templates', permission: 'USER_MANAGE' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: Boxes,
        permissions: ['INVENTORY_VIEW', 'WAREHOUSE_MANAGE', 'PRODUCT_MANAGE', 'INVENTORY_ADJUST'],
        subItems: [
          { id: 'inventory-list', label: 'Inventory List', permission: 'INVENTORY_VIEW' },
          { id: 'pos-quotas', label: 'Inventory Allocation', permission: 'INVENTORY_VIEW' },
          { id: 'warehouses', label: 'Warehouses', permission: 'WAREHOUSE_MANAGE' },
          { id: 'products', label: 'Products', permission: 'PRODUCT_MANAGE' },
          { id: 'brands', label: 'Brands', permission: 'PRODUCT_MANAGE' },
          { id: 'categories', label: 'Categories', permission: 'PRODUCT_MANAGE' },
          { id: 'adjustments', label: 'Stock Adjustment', permission: 'INVENTORY_ADJUST' },
        ],
      },
      {
        id: 'purchasing',
        label: 'Purchasing',
        icon: Truck,
        permissions: ['SUPPLIER_MANAGE', 'GRN_PROCESS', 'GTN_PROCESS', 'PRN_PROCESS'],
        subItems: [
          { id: 'suppliers', label: 'Suppliers Directory', permission: 'SUPPLIER_MANAGE' },
          { id: 'grn', label: 'Goods Received (GRN)', permission: 'GRN_PROCESS' },
          { id: 'gtn', label: 'Stock Transfers (GTN)', permission: 'GTN_PROCESS' },
          { id: 'prn', label: 'Purchase Returns (PRN)', permission: 'PRN_PROCESS' },
          { id: 'purchase-orders', label: 'Purchase Orders', permission: 'SUPPLIER_MANAGE' },
        ],
      },
      {
        id: 'delivery',
        label: 'Delivery',
        icon: Truck,
        permissions: ['DELIVERY_VIEW', 'DELIVERY_MANAGE'],
        subItems: [
          { id: 'deliveries', label: 'Delivery Trips', permission: 'DELIVERY_VIEW' },
          { id: 'routes', label: 'Delivery Routes', permission: 'DELIVERY_VIEW' },
          { id: 'vehicles', label: 'Fleet Vehicles', permission: 'DELIVERY_VIEW' },
          { id: 'gps-tracking', label: 'Live GPS Tracking (Coming Soon)', permission: 'DELIVERY_VIEW' },
        ],
      },
      {
        id: 'accounting',
        label: 'Accounting',
        icon: BookOpen,
        permissions: ['ACCOUNTING_VIEW','ACCOUNTING_MANAGE'],
        subItems: [
          { id: 'chart-of-accounts', label: 'Chart of Accounts' },
          { id: 'banking', label: 'Banking' },
          { id: 'cheques', label: 'Cheques' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'dividend', label: 'Dividend' },
          { id: 'journal-entries', label: 'Journal Entries' },
        ],
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: BarChart3,
        permissions: ['REPORT_VIEW', 'AUDIT_VIEW'],
        subItems: [
          { id: 'customer-reports', label: 'Customer Reports', permission: 'REPORT_VIEW' },
          { id: 'sales-reports', label: 'Sales Report', permission: 'REPORT_VIEW' },
          { id: 'inventory-reports', label: 'Inventory Reports', permission: 'REPORT_VIEW' },
          { id: 'purchase-reports', label: 'Purchase Reports', permission: 'REPORT_VIEW' },
          { id: 'accounting-reports', label: 'Accounting Reports', permission: 'REPORT_VIEW' },
          { id: 'day-summary', label: 'Day Summary', permission: 'REPORT_VIEW' },
        ],
      },
    ],
    []
  );

  // Filter accessible modules based on permissions
  const accessibleModules = useMemo(() => {
    return moduleDefinitions
      .filter((mod) => {
        if (isSuperAdmin) return true;
        if (!mod.permissions || mod.permissions.length === 0) return true;
        return mod.permissions.some((p) => userPermissions.includes(p));
      })
      .map((mod) => {
        if (!mod.subItems) return mod;
        const allowedSubs = mod.subItems.filter(
          (sub) => isSuperAdmin || !sub.permission || userPermissions.includes(sub.permission)
        );
        return { ...mod, subItems: allowedSubs };
      });
  }, [moduleDefinitions, isSuperAdmin, userPermissions]);

  const allowedModuleIds = useMemo(
    () => accessibleModules.map((m) => m.id),
    [accessibleModules]
  );

  // Seamless navigation helper supporting legacy and restructured routes
  const navigateTo = useCallback((view, sub = '') => {
    if (view === 'pos') {
      setCurrentView('invoicing');
      setSubTab('pos');
    } else if (view === 'invoicing') {
      setCurrentView('invoicing');
      setSubTab(sub || 'sales');
    } else if (view === 'sales' || view === 'invoices') {
      setCurrentView('invoicing');
      setSubTab('sales');
    } else if (view === 'quotations') {
      setCurrentView('invoicing');
      setSubTab('quotations');
    } else if (view === 'hold-bills' || view === 'held-bills' || view === 'held') {
      setCurrentView('invoicing');
      setSubTab('hold-bills');
    } else if (view === 'orders') {
      setCurrentView('invoicing');
      setSubTab('sales');
    } else if (view === 'payments') {
      setCurrentView('invoicing');
      setSubTab('payments');
    } else if (view === 'advance-payments') {
      setCurrentView('invoicing');
      setSubTab('advance-payments');
    } else if (view === 'refunds' || view === 'sales-returns') {
      setCurrentView('invoicing');
      setSubTab('refunds');
    } else if (view === 'accounting') {
      setCurrentView('accounting');
      setSubTab(sub || 'chart-of-accounts');
    } else if (view === 'admin' || view === 'users' || view === 'employees') {
      setCurrentView('employees');
      setSubTab(sub || 'list');
    } else if (view === 'brands') {
      setCurrentView('inventory');
      setSubTab('brands');
    } else if (view === 'roles' || view === 'groups') {
      setCurrentView('employees');
      setSubTab('roles');
    } else if (view === 'targets' || view === 'sales-targets') {
      setCurrentView('employees');
      setSubTab('targets');
    } else if (view === 'pending-approvals' || view === 'pending_approvals') {
      setCurrentView('employees');
      setSubTab('pending-approvals');
    } else if (view === 'grn' || view === 'gtn' || view === 'prn' || view === 'suppliers' || view === 'purchase-orders') {
      setCurrentView('purchasing');
      setSubTab(view);
    } else if (view === 'delivery' || view === 'deliveries') {
      setCurrentView('delivery');
      setSubTab(sub || 'deliveries');
    } else if (view === 'delivery-routes') {
      setCurrentView('delivery');
      setSubTab('routes');
    } else if (view === 'vehicles') {
      setCurrentView('delivery');
      setSubTab('vehicles');
    } else if (view === 'inventory') {
      setCurrentView('inventory');
      setSubTab(sub || 'inventory-list');
    } else if (view === 'inventory-list') {
      setCurrentView('inventory');
      setSubTab('inventory-list');
    } else if (view === 'warehouses') {
      setCurrentView('inventory');
      setSubTab('warehouses');
    } else if (view === 'products') {
      setCurrentView('inventory');
      setSubTab('products');
    } else if (view === 'categories') {
      setCurrentView('inventory');
      setSubTab('categories');
    } else if (view === 'stock' || view === 'adjustments') {
      setCurrentView('inventory');
      setSubTab('adjustments');
    } else if (view === 'customers') {
      setCurrentView('customers');
      setSubTab(sub || 'list');
    } else if (view === 'customer-history' || view === 'customer_history') {
      setCurrentView('customers');
      setSubTab('history');
    } else if (view === 'customer-groups' || view === 'routes') {
      setCurrentView('customers');
      setSubTab('groups');
    } else if (view === 'masters') {
      if (sub === 'customers') {
        setCurrentView('customers');
        setSubTab('list');
      } else if (sub === 'suppliers') {
        setCurrentView('purchasing');
        setSubTab('suppliers');
      } else if (sub === 'warehouses' || sub === 'categories') {
        setCurrentView('inventory');
        setSubTab(sub === 'warehouses' ? 'warehouses' : 'products');
      } else {
        setCurrentView('inventory');
        setSubTab('products');
      }
    } else if (view === 'reports') {
      setCurrentView('reports');
      setSubTab(sub || 'customer-reports');
    } else if (view === 'audit' || view === 'day-summary' || view === 'audit-trail') {
      setCurrentView('reports');
      setSubTab('day-summary');
    } else {
      setCurrentView(view);
      setSubTab(sub || '');
    }
  }, []);

  // Redirect to first permitted module if current view is not accessible
  useEffect(() => {
    if (user && allowedModuleIds.length > 0) {
      if (!allowedModuleIds.includes(currentView)) {
        navigateTo(allowedModuleIds[0]);
      }
    }
  }, [user, allowedModuleIds, currentView, navigateTo]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err);
        });
      }
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const isModalOpen = Boolean(document.querySelector('.modal-backdrop') || showShortcutsModal);

  const closeModals = useCallback(() => {
    if (showShortcutsModal) {
      setShowShortcutsModal(false);
      return;
    }
    const closeBtn = document.querySelector(
      '.modal-backdrop button[title*="Close"], .modal-backdrop button:has(svg.lucide-x), .modal-backdrop button.btn-glass'
    );
    if (closeBtn) closeBtn.click();
  }, [showShortcutsModal]);

  // Global ERP shortcuts listener
  useErpShortcuts({
    toggleFullscreen,
    toggleSidebar,
    openShortcutsModal: () => setShowShortcutsModal(true),
    closeModals,
    navigateTo,
    isModalOpen,
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading enterprise session...
      </div>
    );
  }

  if (!user) {
    return authMode === 'signup' ? (
      <SignupView onSwitchToLogin={() => setAuthMode('login')} />
    ) : (
      <LoginView onSwitchToSignup={() => setAuthMode('signup')} />
    );
  }

  const isPosMode = (currentView === 'invoicing' && subTab === 'pos') || currentView === 'pos';

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation - Hidden in POS Mode */}
      {!isPosMode && (
        <aside
          className={`glass-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
          style={{
            width: isSidebarCollapsed ? '64px' : '235px',
            minWidth: isSidebarCollapsed ? '64px' : '235px',
            height: '100vh',
            maxHeight: '100vh',
            position: 'sticky',
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 40,
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          <div style={{ padding: isSidebarCollapsed ? '16px 8px' : '16px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {/* Logo & Brand Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                padding: isSidebarCollapsed ? '0' : '4px 6px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    backgroundColor: '#0284c7',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: isSidebarCollapsed ? 'pointer' : 'default',
                  }}
                  onClick={isSidebarCollapsed ? toggleSidebar : undefined}
                  title="NBH ERP"
                >
                  <Package size={17} />
                </div>
                {!isSidebarCollapsed && (
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0284c7', letterSpacing: '-0.02em' }}>
                    NBH ERP
                  </div>
                )}
              </div>

              {/* Minimize button inside sidebar */}
              {!isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Minimize Sidebar (Ctrl+B)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
            </div>

            {/* When collapsed, show small expand button right below logo */}
            {isSidebarCollapsed && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Expand Sidebar (Ctrl+B)"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '5px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#0284c7')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                >
                  <PanelLeftOpen size={14} />
                </button>
              </div>
            )}

            {/* Standard Navigation Buttons */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {accessibleModules.map((mod) => {
                const Icon = mod.icon;
                const isCurrentModule = currentView === mod.id;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    title={isSidebarCollapsed ? mod.label : undefined}
                    onClick={() => {
                      navigateTo(mod.id, mod.subItems?.[0]?.id || '');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                      width: '100%',
                      padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isCurrentModule ? '#f0f9ff' : 'transparent',
                      color: isCurrentModule ? '#0284c7' : '#475569',
                      fontWeight: isCurrentModule ? 600 : 500,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      position: 'relative',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentModule) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrentModule) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                      <Icon
                        size={18}
                        color={isCurrentModule ? '#0284c7' : '#64748b'}
                        style={{ flexShrink: 0 }}
                      />
                      {!isSidebarCollapsed && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mod.label}
                        </span>
                      )}
                    </div>

                    {!isSidebarCollapsed && isCurrentModule && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#0284c7',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* If no modules permitted */}
            {accessibleModules.length === 0 && (
              <div style={{ padding: '28px 14px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                <Lock size={24} style={{ margin: '0 auto 10px auto', display: 'block', color: '#94a3b8' }} />
                No modules assigned to your role.
              </div>
            )}
          </div>

          {/* Sidebar Footer: Profile & Connected Status Fixed to Bottom */}
          <SidebarProfile
            isCollapsed={isSidebarCollapsed}
            onNavigate={navigateTo}
            onOpenShortcuts={() => setShowShortcutsModal(true)}
          />
        </aside>
      )}

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Dynamic Workspace Rendering */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', minHeight: 0, minWidth: 0, width: '100%', position: 'relative' }}>
          {accessibleModules.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <ShieldAlert size={28} />
              </div>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', marginBottom: '8px' }}>No Modules Assigned</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>
                Your account is active, but no system modules or permissions have been assigned to your role yet.
                Please contact an administrator to configure role permissions for your account.
              </p>
            </div>
          ) : !allowedModuleIds.includes(currentView) ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#ef4444',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <Lock size={28} />
              </div>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', marginBottom: '8px' }}>Access Restricted</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>
                You do not have permission to view this module.
              </p>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && <DashboardView onNavigate={navigateTo} />}
              {currentView === 'invoicing' && (
                <InvoicingHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'customers' && (
                <CustomersHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'employees' && (
                <EmployeesHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'inventory' && (
                <InventoryHub activeSubTab={subTab} onSubTabChange={setSubTab} onNavigate={navigateTo} />
              )}
              {currentView === 'purchasing' && (
                <PurchasingHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'delivery' && (
                <DeliveryHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'accounting' && (
                <AccountingHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'reports' && (
                <ReportsView activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Fullscreen Trigger Button (Hidden in POS mode) */}
      {!isPosMode && (
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen (F11 or Alt+Enter)' : 'Enter Full Screen (F11 or Alt+Enter)'}
          style={{
            position: 'fixed',
            bottom: '18px',
            right: '18px',
            zIndex: 80,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#2563eb',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.borderColor = '#94a3b8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>
      )}

      {/* Standard ERP Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}

export default function App() { return <Suspense fallback={<div role="status" style={{padding:32}}>Loading…</div>}><AppContent /></Suspense>; }
