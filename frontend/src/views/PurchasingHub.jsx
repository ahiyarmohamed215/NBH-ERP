import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import MastersView from './MastersView';
import GrnView from './GrnView';
import GtnView from './GtnView';
import PrnView from './PrnView';
import PurchaseOrdersView from './PurchaseOrdersView';
import {
  Truck,
  FileCheck,
  ArrowRightLeft,
  RotateCcw,
  ShoppingBag,
  Plus,
} from 'lucide-react';

export default function PurchasingHub({ activeSubTab, onSubTabChange }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userPermissions = user?.permissions || [];

  const [editingForms, setEditingForms] = useState({});
  const formCallbacks = React.useMemo(() => Object.fromEntries(['grn','gtn','prn','purchase-orders'].map(id => [id, open => setEditingForms(previous=>({...previous,[id]:open}))])), []);

  const mastersRef = useRef(null);
  const grnRef = useRef(null);
  const gtnRef = useRef(null);
  const prnRef = useRef(null);
  const poRef = useRef(null);

  const subTabs = [
    {
      id: 'suppliers',
      label: 'Supplier List',
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

  const focusedDocument = Boolean(editingForms[currentTab]);

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

  const handleHeaderAction = () => {
    if (currentTab === 'suppliers') {
      mastersRef.current?.openAdd();
    } else if (currentTab === 'grn') {
      if (grnRef.current?.openCreate) grnRef.current.openCreate();
      else grnRef.current?.openIntake?.();
    } else if (currentTab === 'gtn') {
      if (gtnRef.current?.openCreate) gtnRef.current.openCreate();
      else gtnRef.current?.focusForm?.();
    } else if (currentTab === 'prn') {
      if (prnRef.current?.openCreate) prnRef.current.openCreate();
      else prnRef.current?.focusForm?.();
    } else if (currentTab === 'purchase-orders') {
      poRef.current?.openCreate?.();
    }
  };

  return (
    <div
      style={{
        padding: focusedDocument ? '12px' : '24px 32px',
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!focusedDocument && <>
      {/* Page Header (Fixed / Sticky to Desktop Screen - Exact CustomerHub Look) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
            }}
          >
            Purchasing Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Manage registered procurement vendors, purchase orders, goods receipts (GRN), and stock transfers (GTN).
          </p>
        </div>

        {/* Dynamic Action Button (CustomerHub Styled Button) */}
        {currentTab === 'suppliers' ? (
          <button
            type="button"
            onClick={handleHeaderAction}
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
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> Add Supplier
          </button>
        ) : currentTab === 'grn' ? (
          <button
            type="button"
            onClick={handleHeaderAction}
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
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> Create GRN
          </button>
        ) : currentTab === 'gtn' ? (
          <button
            type="button"
            onClick={handleHeaderAction}
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
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <ArrowRightLeft size={16} /> New Stock Transfer
          </button>
        ) : currentTab === 'prn' ? (
          <button
            type="button"
            onClick={handleHeaderAction}
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
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <RotateCcw size={16} /> New Purchase Return
          </button>
        ) : currentTab === 'purchase-orders' ? (
          <button
            type="button"
            onClick={handleHeaderAction}
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
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> Create Purchase Order
          </button>
        ) : null}
      </div>

      {/* Subtabs Bar (Underline Style matching CustomersHub - Fixed / Sticky) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #0284c7' : '2.5px solid transparent',
                padding: '10px 4px',
                fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0284c7' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#0284c7' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      </>}
      {/* View Content (Kept mounted once visited so pages do not reload, reset, or move) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {visitedTabs.has('suppliers') && (
          <div style={{ display: currentTab === 'suppliers' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <MastersView
              ref={mastersRef}
              activeSubTab="suppliers"
              isStandalone={true}
              allowedTabs={['suppliers']}
              hideHeader={true}
            />
          </div>
        )}
        {visitedTabs.has('grn') && (
          <div style={{ display: currentTab === 'grn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <GrnView ref={grnRef} onFormModeChange={formCallbacks.grn} />
          </div>
        )}
        {visitedTabs.has('gtn') && (
          <div style={{ display: currentTab === 'gtn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <GtnView ref={gtnRef} onFormModeChange={formCallbacks.gtn} />
          </div>
        )}
        {visitedTabs.has('prn') && (
          <div style={{ display: currentTab === 'prn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <PrnView ref={prnRef} onFormModeChange={formCallbacks.prn} />
          </div>
        )}
        {visitedTabs.has('purchase-orders') && (
          <div style={{ display: currentTab === 'purchase-orders' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <PurchaseOrdersView ref={poRef} onFormModeChange={formCallbacks['purchase-orders']} />
          </div>
        )}
      </div>
    </div>
  );
}
