import {canWriteTab,hasPermission} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import {canAccessTab} from '../utils/moduleAccess';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import '../components/PurchasingAppearance.css';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import MastersView from './MastersView';
import {WorkspaceActivity} from '../components/RetainedWorkspaces';
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
  const defaultTab = allowedTabs[0]?.id || 'suppliers';

  const [currentTab, setCurrentTab] = useModuleTab('purchasing',activeSubTab || defaultTab,defaultTab,user);
  const effectiveTab = currentTab || defaultTab;

  const focusedDocument = Boolean(editingForms[effectiveTab]);

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([effectiveTab]));
  useEffect(()=>{if(effectiveTab)setVisitedTabs(previous=>previous.has(effectiveTab)?previous:new Set([...previous,effectiveTab]));},[effectiveTab]);

  useEffect(() => {
    if (activeSubTab && allowedTabs.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
      setVisitedTabs((prev) => new Set([...prev, activeSubTab]));
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (effectiveTab && onSubTabChange && effectiveTab !== activeSubTab) {
      onSubTabChange(effectiveTab);
    }
  }, [effectiveTab, activeSubTab, onSubTabChange]);

  // Consume the navigation action after the GTN view has mounted, including retained tabs.
  useEffect(()=>{
    if(!createRequest || createRequest.id===handledCreateRequest.current || createRequest.tab!==effectiveTab || !allowedTabs.some(tab=>tab.id===effectiveTab))return;
    if(createRequest.tab==='gtn' && gtnRef.current?.openCreate){
      handledCreateRequest.current=createRequest.id;
      gtnRef.current.openCreate();
      onCreateRequestHandled?.(createRequest.id);
    }
  },[createRequest,effectiveTab,visitedTabs,onCreateRequestHandled,user]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    setVisitedTabs((prev) => new Set([...prev, tabId]));
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const handleHeaderAction = () => {
    if (effectiveTab === 'suppliers') {
      mastersRef.current?.openAdd();
    } else if (effectiveTab === 'grn') {
      if (grnRef.current?.openCreate) grnRef.current.openCreate();
      else grnRef.current?.openIntake?.();
    } else if (effectiveTab === 'gtn') {
      if (gtnRef.current?.openCreate) gtnRef.current.openCreate();
      else gtnRef.current?.focusForm?.();
    } else if (effectiveTab === 'prn') {
      if (prnRef.current?.openCreate) prnRef.current.openCreate();
      else prnRef.current?.focusForm?.();
    } else if (effectiveTab === 'purchase-orders') {
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
          <h1 className="erp-page-title">
            Purchasing Management
          </h1>
          <p className="erp-page-description">
            Manage registered procurement vendors, purchase orders, goods receipts (GRN), and stock transfers (GTN).
          </p>
        </div>

        {/* Dynamic Action Button (CustomerHub Styled Button) */}
        {effectiveTab === 'suppliers' ? (
          <button disabled={!canWriteTab(user,'purchasing',effectiveTab)} className="erp-button erp-button-primary"
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
        ) : effectiveTab === 'grn' ? (
          <button disabled={!canWriteTab(user,'purchasing',effectiveTab)} className="erp-button erp-button-primary"
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
        ) : effectiveTab === 'gtn' ? (
          <button disabled={!canWriteTab(user,'purchasing',effectiveTab)} className="erp-button erp-button-primary"
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
        ) : effectiveTab === 'prn' ? (
          <button disabled={!canWriteTab(user,'purchasing',effectiveTab)} className="erp-button erp-button-primary"
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
        ) : effectiveTab === 'purchase-orders' ? (
          <button disabled={!canWriteTab(user,'purchasing',effectiveTab)} className="erp-button erp-button-primary"
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
          const isActive = effectiveTab === tab.id;
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
        {(visitedTabs.has('suppliers') || effectiveTab === 'suppliers') && (
          <div style={{ display: effectiveTab === 'suppliers' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceActivity active={effectiveTab === 'suppliers'}><MastersView
              ref={mastersRef}
              onFormModeChange={formCallbacks.suppliers}
              activeSubTab="suppliers"
              isStandalone={true}
              allowedTabs={['suppliers']}
              hideHeader={true}
            /></WorkspaceActivity>
          </div>
        )}
        {(visitedTabs.has('grn') || effectiveTab === 'grn') && (
          <div style={{ display: effectiveTab === 'grn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceActivity active={effectiveTab === 'grn'}><GrnView ref={grnRef} onFormModeChange={formCallbacks.grn} /></WorkspaceActivity>
          </div>
        )}
        {(visitedTabs.has('gtn') || effectiveTab === 'gtn') && (
          <div style={{ display: effectiveTab === 'gtn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceActivity active={effectiveTab === 'gtn'}><GtnView ref={gtnRef} onFormModeChange={formCallbacks.gtn} /></WorkspaceActivity>
          </div>
        )}
        {(visitedTabs.has('prn') || effectiveTab === 'prn') && (
          <div style={{ display: effectiveTab === 'prn' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceActivity active={effectiveTab === 'prn'}><PrnView ref={prnRef} onFormModeChange={formCallbacks.prn} /></WorkspaceActivity>
          </div>
        )}
        {(visitedTabs.has('purchase-orders') || effectiveTab === 'purchase-orders') && (
          <div style={{ display: effectiveTab === 'purchase-orders' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceActivity active={effectiveTab === 'purchase-orders'}><PurchaseOrdersView ref={poRef} onFormModeChange={formCallbacks['purchase-orders']} /></WorkspaceActivity>
          </div>
        )}
      </div>
    </div>
  );
}
