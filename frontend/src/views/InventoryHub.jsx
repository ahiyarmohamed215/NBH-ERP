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

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([currentTab]));

  useEffect(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
      setVisitedTabs((prev) => new Set([...prev, activeSubTab]));
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    setVisitedTabs((prev) => new Set([...prev, tabId]));
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Sub-navigation Header Bar (Fixed / Sticky at Top) */}
      <div
        className="glass-sub-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          overflowX: 'auto',
          flexShrink: 0,
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
                style={{
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={17} color={isActive ? '#1d4ed8' : '#64748b'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Content (Kept mounted once visited so pages do not reload, reset, or move) */}
      <div style={{ flex: 1, position: 'relative' }}>
        {visitedTabs.has('stock') && (
          <div style={{ display: currentTab === 'stock' ? 'block' : 'none' }}>
            <InventoryView onNavigate={(view) => handleTabClick(view)} />
          </div>
        )}
        {visitedTabs.has('grn') && (
          <div style={{ display: currentTab === 'grn' ? 'block' : 'none' }}>
            <GrnView />
          </div>
        )}
        {visitedTabs.has('gtn') && (
          <div style={{ display: currentTab === 'gtn' ? 'block' : 'none' }}>
            <GtnView />
          </div>
        )}
        {visitedTabs.has('prn') && (
          <div style={{ display: currentTab === 'prn' ? 'block' : 'none' }}>
            <PrnView />
          </div>
        )}
        {visitedTabs.has('adjustments') && (
          <div style={{ display: currentTab === 'adjustments' ? 'block' : 'none' }}>
            <AdjustmentsView />
          </div>
        )}
      </div>
    </div>
  );
}
