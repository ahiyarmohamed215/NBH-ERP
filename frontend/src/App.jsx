import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [currentView, setCurrentView] = useState('dashboard');
  const [subTab, setSubTab] = useState('');

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
        { id: 'stock', label: 'Stock & Ledger', permission: 'INVENTORY_VIEW' },
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
      id: 'products',
      label: 'Products Catalog',
      icon: Package,
      permissions: ['PRODUCT_MANAGE'],
    },
    {
      id: 'masters',
      label: 'Business Directories',
      icon: Database,
      permissions: ['WAREHOUSE_MANAGE', 'CUSTOMER_MANAGE', 'SUPPLIER_MANAGE'],
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
  const navigateTo = (view, sub = '') => {
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
  };

  // Redirect to first permitted module if current view is not accessible
  useEffect(() => {
    if (user && allowedModuleIds.length > 0) {
      if (!allowedModuleIds.includes(currentView)) {
        navigateTo(allowedModuleIds[0]);
      }
    }
  }, [user, allowedModuleIds, currentView]);

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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation */}
      <aside
        className="glass-sidebar"
        style={{
          width: '260px',
          minWidth: '260px',
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
        <div style={{ padding: '20px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Logo & Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 4px', marginBottom: '24px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Package size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                NBH ERP
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                Enterprise System
              </div>
            </div>
          </div>

          {/* Navigation Menu Header */}
          <div
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
        <SidebarProfile onNavigate={navigateTo} />
      </aside>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
        {/* Dynamic Workspace Rendering */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
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
              {currentView === 'products' && <ProductsView />}
              {currentView === 'masters' && <MastersView />}
              {currentView === 'reports' && <ReportsView />}
              {currentView === 'admin' && (
                <AdminHub activeSubTab={subTab} onSubTabChange={setSubTab} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
