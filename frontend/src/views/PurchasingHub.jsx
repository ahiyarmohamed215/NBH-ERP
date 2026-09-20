import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MastersView from './MastersView';
import GrnView from './GrnView';
import GtnView from './GtnView';
import PrnView from './PrnView';
import {
  Truck,
  FileCheck,
  ArrowRightLeft,
  RotateCcw,
  ShoppingBag,
  Clock,
} from 'lucide-react';

export default function PurchasingHub({ activeSubTab, onSubTabChange }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  const subTabs = [
    {
      id: 'suppliers',
      label: 'Suppliers Directory',
      icon: Truck,
      permission: 'SUPPLIER_MANAGE',
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
      id: 'purchase-orders',
      label: 'Purchase Orders',
      icon: ShoppingBag,
      permission: 'PURCHASE_MANAGE',
    },
  ];

  // Filter accessible tabs
  const allowedTabs = subTabs.filter(
    (tab) =>
      isSuperAdmin ||
      !tab.permission ||
      userPermissions.includes(tab.permission) ||
      (tab.id === 'purchase-orders' && (isSuperAdmin || userPermissions.includes('SUPPLIER_MANAGE')))
  );

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return allowedTabs.length > 0 ? allowedTabs[0].id : 'suppliers';
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
    <div style={{ flex: 1, height: '100%', maxHeight: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {visitedTabs.has('suppliers') && (
          <div style={{ display: currentTab === 'suppliers' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <MastersView
              activeSubTab="suppliers"
              isStandalone={true}
              allowedTabs={['suppliers']}
              title="Supplier Directory"
              subtitle="Manage registered procurement vendors, contact personnel, and addresses"
            />
          </div>
        )}
        {visitedTabs.has('grn') && (
          <div style={{ display: currentTab === 'grn' ? 'block' : 'none', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <GrnView />
          </div>
        )}
        {visitedTabs.has('gtn') && (
          <div style={{ display: currentTab === 'gtn' ? 'block' : 'none', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <GtnView />
          </div>
        )}
        {visitedTabs.has('prn') && (
          <div style={{ display: currentTab === 'prn' ? 'block' : 'none', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <PrnView />
          </div>
        )}
        {visitedTabs.has('purchase-orders') && (
          <div style={{ display: currentTab === 'purchase-orders' ? 'block' : 'none', flex: 1, minHeight: 0, overflowY: 'auto', padding: '60px 24px' }}>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '48px 24px',
                maxWidth: '520px',
                margin: '0 auto',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <ShoppingBag size={28} />
              </div>
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '8px' }}>
                Purchase Orders (PO) Workflow
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '20px' }}>
                Purchase Order creation, supplier approvals, and automatic conversion to GRN upon delivery
                will be available soon.
              </p>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '4px 12px', borderRadius: '9999px' }}>
                COMING SOON
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
