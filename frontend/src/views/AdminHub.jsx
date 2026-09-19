import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import UsersView from './UsersView';
import RolesView from './RolesView';
import { Users, ShieldCheck } from 'lucide-react';

export default function AdminHub({ activeSubTab, onSubTabChange }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  const subTabs = [
    {
      id: 'users',
      label: 'User Approvals & Staff',
      icon: Users,
      permission: 'USER_MANAGE',
    },
    {
      id: 'roles',
      label: 'Custom Roles & Permissions',
      icon: ShieldCheck,
      permissions: ['ROLE_MANAGE', 'USER_MANAGE'],
    },
  ];

  const allowedTabs = subTabs.filter(
    (tab) =>
      isSuperAdmin ||
      (tab.permission && userPermissions.includes(tab.permission)) ||
      (tab.permissions && tab.permissions.some((p) => userPermissions.includes(p)))
  );

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return allowedTabs.length > 0 ? allowedTabs[0].id : 'users';
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
        {currentTab === 'users' && <UsersView />}
        {currentTab === 'roles' && <RolesView />}
      </div>
    </div>
  );
}
