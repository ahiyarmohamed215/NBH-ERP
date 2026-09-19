import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PosView from './PosView';
import SalesReturnsView from './SalesReturnsView';
import SalesAccountingView from './SalesAccountingView';
import { ShoppingCart, Undo2, Users } from 'lucide-react';

export default function SalesHub({ activeSubTab, onSubTabChange }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  const subTabs = [
    {
      id: 'pos',
      label: 'POS Terminal & Invoicing',
      icon: ShoppingCart,
      permission: 'SALES_CREATE',
    },
    {
      id: 'returns',
      label: 'Sales Returns & Credit Notes',
      icon: Undo2,
      permission: 'SALES_RETURN',
    },
    {
      id: 'accounting',
      label: 'User Sales Accounting',
      icon: Users,
      permission: 'SALES_VIEW_ALL',
    },
  ];

  const allowedTabs = subTabs.filter(
    (tab) => isSuperAdmin || userPermissions.includes(tab.permission)
  );

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return allowedTabs.length > 0 ? allowedTabs[0].id : 'pos';
  });

  useEffect(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Sub-navigation Header Bar */}
      <div
        className="glass-sub-header"
        style={{
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div className="glass-pill-bar">
          {allowedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`glass-pill-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} color={isActive ? '#1d4ed8' : '#64748b'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Content */}
      <div style={{ flex: 1 }}>
        {currentTab === 'pos' && <PosView />}
        {currentTab === 'returns' && <SalesReturnsView />}
        {currentTab === 'accounting' && <SalesAccountingView />}
      </div>
    </div>
  );
}

