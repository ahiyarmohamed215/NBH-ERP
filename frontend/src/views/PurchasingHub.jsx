import {canWriteTab,hasPermission} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import {canAccessTab} from '../utils/moduleAccess';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import '../components/PurchasingAppearance.css';
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

export default function PurchasingHub({ activeSubTab, onSubTabChange, createRequest, onCreateRequestHandled }) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(
    user?.username === 'admin' ||
    user?.roles?.includes('ROLE_SUPER_ADMIN') ||
    user?.roles?.includes('SUPER_ADMIN') ||
    user?.roles?.includes('ROLE_ADMIN')
  );
  const userPermissions = user?.permissions || [];

  const [editingForms, setEditingForms] = useState({});
  const formCallbacks = React.useMemo(() => Object.fromEntries(['suppliers','grn','gtn','prn','purchase-orders'].map(id => [id, open => setEditingForms(previous=>({...previous,[id]:open}))])), []);

  const mastersRef = useRef(null);
  const grnRef = useRef(null);
  const gtnRef = useRef(null);
  const prnRef = useRef(null);
  const poRef = useRef(null);
  const handledCreateRequest=useRef(null);

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
      label: 'Purchase Order (PO)',
      icon: ShoppingBag,
      permission: 'PURCHASE_MANAGE',
    },
  ];

  // Filter accessible tabs
  const allowedTabs = subTabs.filter(tab=>canAccessTab(user,'purchasing',tab.id));

  const [currentTab, setCurrentTab] = useModuleTab('purchasing',activeSubTab,'suppliers',user);

  const focusedDocument = Boolean(editingForms[currentTab]);

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([currentTab]));
  useEffect(()=>{if(currentTab)setVisitedTabs(previous=>previous.has(currentTab)?previous:new Set([...previous,currentTab]));},[currentTab]);

  useEffect(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
      setVisitedTabs((prev) => new Set([...prev, activeSubTab]));
    }
  }, [activeSubTab]);

  // Consume the navigation action after the GTN view has mounted, including retained tabs.
  useEffect(()=>{
    if(!createRequest || createRequest.id===handledCreateRequest.current || createRequest.tab!==currentTab || !allowedTabs.some(tab=>tab.id===currentTab))return;
    if(createRequest.tab==='gtn' && gtnRef.current?.openCreate){
      handledCreateRequest.current=createRequest.id;
      gtnRef.current.openCreate();
      onCreateRequestHandled?.(createRequest.id);
    }
  },[createRequest,currentTab,visitedTabs,onCreateRequestHandled,user]);

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
    <div className="purchasing-no-shadows erp-page" data-focused={focusedDocument}
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
      <div className="erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="erp-page-title"

          >
            Purchasing Management
          </h1>
          <p className="erp-page-description">
            Manage registered procurement vendors, purchase orders, goods receipts (GRN), and stock transfers (GTN).
          </p>
        </div>

        {/* Dynamic Action Button (CustomerHub Styled Button) */}
        {currentTab === 'suppliers' ? (
          <button disabled={!canWriteTab(user,'purchasing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAction}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> New Supplier
          </button>
        ) : currentTab === 'grn' ? (
          <button disabled={!canWriteTab(user,'purchasing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAction}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> New Goods Received
          </button>
        ) : currentTab === 'gtn' ? (
          <button disabled={!canWriteTab(user,'purchasing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAction}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <ArrowRightLeft size={16} /> New Stock Transfer
          </button>
        ) : currentTab === 'prn' ? (
          <button disabled={!canWriteTab(user,'purchasing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAction}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <RotateCcw size={16} /> New Purchase Return
          </button>
        ) : currentTab === 'purchase-orders' ? (
          <button disabled={!canWriteTab(user,'purchasing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAction}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={17} /> New Purchase Order
          </button>
        ) : null}
      </div>

      {/* Subtabs Bar (Underline Style matching CustomersHub - Fixed / Sticky) */}
      <ErpTabs module="purchasing"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <ErpTab tabId={tab.id} data-active={isActive} aria-pressed={isActive}
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}

            >
              <Icon size={16} />
              {tab.label}
            </ErpTab>
          );
        })}
      </ErpTabs>

      </>}
      {/* View Content (Kept mounted once visited so pages do not reload, reset, or move) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {visitedTabs.has('suppliers') && (
          <div style={{ display: currentTab === 'suppliers' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <MastersView
              ref={mastersRef}
              onFormModeChange={formCallbacks.suppliers}
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
