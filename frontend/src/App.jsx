import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import LoginView from './views/LoginView';
import SignupView from './views/SignupView';
import DashboardView from './views/DashboardView';
import InventoryHub from './views/InventoryHub';
import SalesHub from './views/SalesHub';
import ProductsView from './views/ProductsView';
import MastersView from './views/MastersView';
import ReportsView from './views/ReportsView';
import AdminHub from './views/AdminHub';
import SidebarProfile from './components/SidebarProfile';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import useErpShortcuts from './hooks/useErpShortcuts';

import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Database,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  Lock,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
  Monitor,
} from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [currentView, setCurrentView] = useState('dashboard');
  const [subTab, setSubTab] = useState('');

  // Fullscreen & Distraction-Free States
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  // Hierarchical primary module definitions
  const moduleDefinitions = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      permissions: ['DASHBOARD_VIEW'],
    },
    {
      id: 'inventory',
      label: 'Inventory Operations',
      icon: Boxes,
      permissions: ['INVENTORY_VIEW', 'GRN_PROCESS', 'GTN_PROCESS', 'PRN_PROCESS', 'INVENTORY_ADJUST'],
      subItems: [
        { id: 'stock', label: 'Stock Balances & Ledger', permission: 'INVENTORY_VIEW' },
        { id: 'grn', label: 'Goods Received (GRN)', permission: 'GRN_PROCESS' },
        { id: 'gtn', label: 'Stock Transfers (GTN)', permission: 'GTN_PROCESS' },
        { id: 'prn', label: 'Purchase Returns (PRN)', permission: 'PRN_PROCESS' },
        { id: 'adjustments', label: 'Stock Adjustments', permission: 'INVENTORY_ADJUST' },
      ],
    },
    {
      id: 'sales',
      label: 'Sales & POS',
      icon: ShoppingCart,
      permissions: ['SALES_CREATE', 'SALES_RETURN'],
      subItems: [
        { id: 'pos', label: 'POS Terminal', permission: 'SALES_CREATE' },
        { id: 'returns', label: 'Sales Returns & Credit', permission: 'SALES_RETURN' },
      ],
    },
    {
      id: 'masters',
      label: 'Business Directories',
      icon: Database,
      permissions: ['WAREHOUSE_MANAGE', 'CUSTOMER_MANAGE', 'SUPPLIER_MANAGE', 'PRODUCT_MANAGE'],
      subItems: [
        { id: 'products', label: 'Products', permission: 'PRODUCT_MANAGE' },
        { id: 'warehouses', label: 'Warehouses', permission: 'WAREHOUSE_MANAGE' },
        { id: 'categories', label: 'Product Categories', permission: 'PRODUCT_MANAGE' },
        { id: 'customers', label: 'Customers', permission: 'CUSTOMER_MANAGE' },
        { id: 'suppliers', label: 'Suppliers', permission: 'SUPPLIER_MANAGE' },
      ],
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: BarChart3,
      permissions: ['REPORT_VIEW', 'AUDIT_VIEW'],
    },
    {
      id: 'admin',
      label: 'System Administration',
      icon: ShieldCheck,
      permissions: ['USER_MANAGE', 'ROLE_MANAGE'],
      adminOnly: true,
      subItems: [
        { id: 'users', label: 'User Approvals & Staff', permission: 'USER_MANAGE' },
        { id: 'roles', label: 'Custom Roles & Perms', permission: 'ROLE_MANAGE' },
      ],
    },
  ], []);

  // Filter accessible modules based on permissions
  const accessibleModules = useMemo(() => {
    return moduleDefinitions
      .filter((mod) => {
        if (isSuperAdmin) return true;
        return mod.permissions.some((p) => userPermissions.includes(p));
      })
      .map((mod) => {
        if (!mod.subItems) return mod;
        const allowedSubs = mod.subItems.filter(
          (sub) => isSuperAdmin || userPermissions.includes(sub.permission)
        );
        return { ...mod, subItems: allowedSubs };
      });
  }, [moduleDefinitions, isSuperAdmin, userPermissions]);

  const allowedModuleIds = useMemo(
    () => accessibleModules.map((m) => m.id),
    [accessibleModules]
  );

  // Seamless navigation helper supporting legacy single routes and hierarchical hubs
  const navigateTo = useCallback((view, sub = '') => {
    if (view === 'pos') {
      setCurrentView('sales');
      setSubTab('pos');
    } else if (view === 'sales-returns') {
      setCurrentView('sales');
      setSubTab('returns');
    } else if (view === 'grn') {
      setCurrentView('inventory');
      setSubTab('grn');
    } else if (view === 'gtn') {
      setCurrentView('inventory');
      setSubTab('gtn');
    } else if (view === 'prn') {
      setCurrentView('inventory');
      setSubTab('prn');
    } else if (view === 'adjustments') {
      setCurrentView('inventory');
      setSubTab('adjustments');
    } else if (view === 'users') {
      setCurrentView('admin');
      setSubTab('users');
    } else if (view === 'roles') {
      setCurrentView('admin');
      setSubTab('roles');
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
          width: isSidebarCollapsed ? '62px' : '260px',
          minWidth: isSidebarCollapsed ? '62px' : '260px',
          height: '100vh',
          maxHeight: '100vh',
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 40,
        }}
      >
        <div style={{ padding: isSidebarCollapsed ? '20px 8px' : '20px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Logo & Brand Header with Small Minimize/Expand Sidebar Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              padding: isSidebarCollapsed ? '0' : '0 4px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: isSidebarCollapsed ? 'pointer' : 'default',
                }}
                onClick={isSidebarCollapsed ? toggleSidebar : undefined}
                title="NBH Enterprise ERP"
              >
                <Package size={20} />
              </div>
              <div className="sidebar-brand-text">
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  NBH ERP
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                  Enterprise System
                </div>
              </div>
            </div>

            {/* Small minimize button inside sidebar */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Minimize Sidebar (Ctrl+B)'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: '6px',
                display: isSidebarCollapsed ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <PanelLeftClose size={16} />
            </button>
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
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              >
                <PanelLeftOpen size={14} />
              </button>
            </div>
          )}

          {/* Navigation Menu Header */}
          <div
            className="sidebar-section-title"
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0 6px',
              marginBottom: '8px',
            }}
          >
            Modules
          </div>

          {/* Standard Navigation Buttons */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                  className={`sidebar-nav-btn ${isCurrentModule ? 'active' : ''}`}
                >
                  <div className="nav-icon-wrap">
                    <Icon
                      size={18}
                      color={isCurrentModule ? '#1d4ed8' : '#64748b'}
                      style={{ flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: isCurrentModule ? 600 : 500 }}>{mod.label}</span>
                  </div>

                  <ChevronRight size={16} className="forward-icon" />
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
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, position: 'relative' }}>
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
              {currentView === 'inventory' && (
                <InventoryHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'sales' && (
                <SalesHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'products' && (
                <MastersView activeSubTab="products" onSubTabChange={setSubTab} />
              )}
              {currentView === 'masters' && (
                <MastersView activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
              {currentView === 'reports' && <ReportsView />}
              {currentView === 'admin' && (
                <AdminHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Fullscreen Trigger Button (Icon Only) */}
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
