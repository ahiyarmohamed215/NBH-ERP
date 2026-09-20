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
  const [currentView, setCurrentView] = useState('dashboard');
  const [subTab, setSubTab] = useState('');

  // Fullscreen & Distraction-Free States
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
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
        label: 'Invoicing',
        icon: FileText,
        permissions: ['SALES_CREATE', 'SALES_RETURN'],
        subItems: [
          { id: 'quotations', label: 'Quotations', permission: 'SALES_CREATE' },
          { id: 'orders', label: 'Orders', permission: 'SALES_CREATE' },
          { id: 'sales', label: 'Sales', permission: 'SALES_CREATE' },
          { id: 'payments', label: 'Payments', permission: 'SALES_CREATE' },
          { id: 'advance-payments', label: 'Advance Payments', permission: 'SALES_CREATE' },
          { id: 'refunds', label: 'Refunds', permission: 'SALES_RETURN' },
        ],
      },
      {
        id: 'customers',
        label: 'Customers',
        icon: Users,
        permissions: ['CUSTOMER_MANAGE'],
        subItems: [
          { id: 'list', label: 'Customer List', permission: 'CUSTOMER_MANAGE' },
          { id: 'groups', label: 'Groups & Routes', permission: 'CUSTOMER_MANAGE' },
        ],
      },
      {
        id: 'employees',
        label: 'Employees',
        icon: Contact,
        permissions: ['USER_MANAGE', 'ROLE_MANAGE'],
        subItems: [
          { id: 'list', label: 'Employee List', permission: 'USER_MANAGE' },
          { id: 'groups', label: 'Groups', permission: 'ROLE_MANAGE' },
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
          { id: 'adjustments', label: 'Stock Adjustment', permission: 'INVENTORY_ADJUST' },
          { id: 'warehouses', label: 'Warehouses', permission: 'WAREHOUSE_MANAGE' },
          { id: 'products', label: 'Products', permission: 'PRODUCT_MANAGE' },
          { id: 'brands', label: 'Brands', permission: 'PRODUCT_MANAGE' },
          { id: 'categories', label: 'Categories', permission: 'PRODUCT_MANAGE' },
          { id: 'reserved', label: 'Reserved', permission: 'INVENTORY_VIEW' },
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
        id: 'accounting',
        label: 'Accounting',
        icon: BookOpen,
        permissions: ['DASHBOARD_VIEW'],
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
          { id: 'project-reports', label: 'Project Report', permission: 'REPORT_VIEW' },
          { id: 'accounting-reports', label: 'Accounting Reports', permission: 'REPORT_VIEW' },
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
    } else if (view === 'orders') {
      setCurrentView('invoicing');
      setSubTab('orders');
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
    } else if (view === 'roles' || view === 'groups') {
      setCurrentView('employees');
      setSubTab('groups');
    } else if (view === 'grn' || view === 'gtn' || view === 'prn' || view === 'suppliers' || view === 'purchase-orders') {
      setCurrentView('purchasing');
      setSubTab(view);
    } else if (view === 'inventory') {
      setCurrentView('inventory');
      setSubTab(sub || 'adjustments');
    } else if (view === 'stock' || view === 'adjustments') {
      setCurrentView('inventory');
      setSubTab('adjustments');
    } else if (view === 'warehouses') {
      setCurrentView('inventory');
      setSubTab('warehouses');
    } else if (view === 'products') {
      setCurrentView('inventory');
      setSubTab('products');
    } else if (view === 'brands') {
      setCurrentView('inventory');
      setSubTab('brands');
    } else if (view === 'categories') {
      setCurrentView('inventory');
      setSubTab('categories');
    } else if (view === 'reserved') {
      setCurrentView('inventory');
      setSubTab('reserved');
    } else if (view === 'customers') {
      setCurrentView('customers');
      setSubTab(sub || 'list');
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
    } else {
      setCurrentView(view);
      if (sub) setSubTab(sub);
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

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation */}
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
          onNavigate={navigateTo}
          onOpenShortcuts={() => setShowShortcutsModal(true)}
        />
      </aside>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Dynamic Workspace Rendering */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, minWidth: 0, width: '100%', position: 'relative' }}>
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
                <InventoryHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'purchasing' && (
                <PurchasingHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'accounting' && (
                <AccountingHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'reports' && <ReportsView activeSubTab={subTab} />}
            </>
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Fullscreen Trigger Button */}
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

      {/* Standard ERP Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
