import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Clock, X } from 'lucide-react';
import PosStaffPerformance from './PosStaffPerformance';
import MonthFilter, { currentBusinessMonth } from './MonthFilter';
import OnholdBillsTable from './OnholdBillsTable';
import HeldBillDetails from './HeldBillDetails';
import { salesApi } from '../api/apiClient';
import './PurchaseInspectionModal.css';
import './PosStaffPerformance.css';
import './PosHeldBills.css';

export default function PosPerformanceDialog({ user, onClose, initialTab = 'rankings', activeBillId }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'rankings');
  const [month, setMonth] = useState(currentBusinessMonth);
  const [scope, setScope] = useState('mine');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [workspace, setWorkspace] = useState(null);
  const [loadingHeld, setLoadingHeld] = useState(true);
  const [errorHeld, setErrorHeld] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectedBill, setSelectedBill] = useState(null);

  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (activeTab !== 'held') return;
    let alive = true;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      try {
        const response = await salesApi.getHeldOriginals({ scope, query, history: true });
        if (alive && request === sequence) {
          const original = response.data?.data || response.data;
          setWorkspace({
            ...original,
            bills: (original?.bills || []).filter(b => String(b.id) !== String(activeBillId))
          });
          setErrorHeld('');
        }
      } catch (e) {
        if (alive && request === sequence) setErrorHeld(e.message || 'Unable to load onhold bills.');
      } finally {
        if (alive && request === sequence) setLoadingHeld(false);
      }
    };
    setLoadingHeld(true);
    setWorkspace(null);
    setErrorHeld('');
    const timer = setTimeout(load, 200);
    const interval = setInterval(load, 5000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [activeTab, scope, query, activeBillId, revision]);

  useEffect(() => {
    if (selectedBill) return;
    const previous = document.activeElement;
    dialog.current?.querySelector('[aria-label="Close performance"], [aria-label="Close held bills"]')?.focus();
    const key = event => {
      if (document.querySelector('[aria-label="Staff performance details"]')) return;
      if (dialog.current?.contains(event.target)) {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          close.current();
        }
        if (event.key === 'Tab') {
          const controls = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')];
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus?.();
    };
  }, [Boolean(selectedBill)]);

  const refreshHeld = () => setRevision(value => value + 1);

  return createPortal(
    <>
      {!selectedBill && (
        <div className="modal-backdrop pos-performance-backdrop" onClick={onClose}>
          <section
            ref={dialog}
            className="purchase-inspection pos-performance-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={activeTab === 'held' ? 'pos-held-title' : 'pos-performance-title'}
            onClick={event => event.stopPropagation()}
          >
            <header className="purchase-inspection-header">
              <div className="purchase-inspection-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="grn-inspection-symbol">
                  {activeTab === 'held' ? <Clock size={22} strokeWidth={1.7} /> : <Trophy size={22} strokeWidth={1.7} />}
                </div>
                <div>
                  <h2
                    id={activeTab === 'held' ? 'pos-held-title' : 'pos-performance-title'}
                    className="erp-dialog-title"
                    style={{ margin: 0 }}
                  >
                    {activeTab === 'held' ? 'Held Bills' : 'Staff Rankings'}
                  </h2>
                  {/* Provide fallback accessible labels */}
                  {activeTab === 'held' ? (
                    <span id="pos-performance-title" style={{ display: 'none' }}>Staff Rankings</span>
                  ) : (
                    <span id="pos-held-title" style={{ display: 'none' }}>Held Bills</span>
                  )}
                </div>

                <nav className="pos-performance-nav" aria-label="Performance Navigation" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    id="tab-pos-rankings"
                    aria-selected={activeTab === 'rankings'}
                    className={`pos-performance-tab-btn ${activeTab === 'rankings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rankings')}
                  >
                    <Trophy size={14} />
                    <span>Staff Rankings</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-pos-held"
                    aria-selected={activeTab === 'held'}
                    className={`pos-performance-tab-btn ${activeTab === 'held' ? 'active' : ''}`}
                    onClick={() => setActiveTab('held')}
                  >
                    <Clock size={14} />
                    <span>Onhold Bills</span>
                  </button>
                </nav>
              </div>

              <div className="pos-performance-header-actions">
                {activeTab === 'rankings' && (
                  <MonthFilter label="Performance month" value={month} onChange={setMonth} />
                )}
                <button
                  type="button"
                  className="purchase-inspection-close"
                  aria-label={activeTab === 'held' ? 'Close held bills' : 'Close performance'}
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="pos-performance-body">
              {activeTab === 'rankings' ? (
                <PosStaffPerformance user={user} month={month} showMonthFilter={false} />
              ) : (
                <div className="pos-held-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {errorHeld && <p className="pos-held-error" role="alert">{errorHeld}</p>}
                  <OnholdBillsTable
                    bills={workspace?.bills || []}
                    loading={loadingHeld}
                    user={user}
                    scope={scope}
                    onScopeChange={setScope}
                    query={query}
                    onQueryChange={setQuery}
                    status={status}
                    onStatusChange={setStatus}
                    onRefresh={refreshHeld}
                    onView={setSelectedBill}
                    posOnly
                    archive
                    history
                    workspace={workspace}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedBill && (
        <HeldBillDetails
          key={selectedBill.id}
          bill={selectedBill}
          user={user}
          posOnly
          onClose={() => setSelectedBill(null)}
          onChanged={refreshHeld}
        />
      )}
    </>,
    document.body
  );
}
