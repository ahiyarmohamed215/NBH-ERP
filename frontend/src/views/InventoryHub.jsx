import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InventoryView from './InventoryView';
import GrnView from './GrnView';
import GtnView from './GtnView';
import PrnView from './PrnView';
import AdjustmentsView from './AdjustmentsView';
import {
  Boxes,
  FileCheck,
  ArrowRightLeft,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

export default function InventoryHub({ activeSubTab, onSubTabChange }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  const subTabs = [
    {
      id: 'stock',
      label: 'Stock Balances & Ledger',
      icon: Boxes,
      permission: 'INVENTORY_VIEW',
    },
    {
      id: 'grn',
      label: 'Goods Received (GRN)',
      icon: FileCheck,
      permission: 'GRN_PROCESS',
    },
    {
      id: 'gtn',
      label: 'Stock Transfers (GTN)',
      icon: ArrowRightLeft,
      permission: 'GTN_PROCESS',
    },
    {
      id: 'prn',
      label: 'Purchase Returns (PRN)',
      icon: RotateCcw,
      permission: 'PRN_PROCESS',
    },
    {
      id: 'adjustments',
      label: 'Stock Adjustments',
      icon: SlidersHorizontal,
      permission: 'INVENTORY_ADJUST',
    },
  ];

  // Filter accessible tabs
  const allowedTabs = subTabs.filter(
    (tab) => isSuperAdmin || userPermissions.includes(tab.permission)
  );

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return allowedTabs.length > 0 ? allowedTabs[0].id : 'stock';
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
          overflowX: 'auto',
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
        {currentTab === 'stock' && <InventoryView onNavigate={(view) => handleTabClick(view)} />}
        {currentTab === 'grn' && <GrnView />}
        {currentTab === 'gtn' && <GtnView />}
        {currentTab === 'prn' && <PrnView />}
        {currentTab === 'adjustments' && <AdjustmentsView />}
      </div>
    </div>
  );
}
