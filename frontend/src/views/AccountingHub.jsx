import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Landmark,
  CreditCard,
  Receipt,
  DollarSign,
  FileSpreadsheet,
  Search,
  Filter,
  Eye,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';

const ACCOUNTING_TABS = [
  {
    id: 'chart-of-accounts',
    label: 'Chart of Accounts',
    title: 'Chart of Accounts',
    subtitle: 'Manage your accounting structure',
    icon: BookOpen,
  },
  {
    id: 'banking',
    label: 'Banking',
    title: 'Banking & Financial Accounts',
    subtitle: 'Manage corporate bank accounts, deposits, statements and cash reconciliations',
    icon: Landmark,
  },
  {
    id: 'cheques',
    label: 'Cheques',
    title: 'Cheque Management & Clearance',
    subtitle: 'Track inward and outward cheque clearing, deposits, maturity dates and dishonor logs',
    icon: CreditCard,
  },
  {
    id: 'expenses',
    label: 'Expenses',
    title: 'Operating Expenses & Petty Cash',
    subtitle: 'Record overhead expenses, petty cash disbursements, category allocation and approvals',
    icon: Receipt,
  },
  {
    id: 'dividend',
    label: 'Dividend',
    title: 'Dividend Distribution & Equity',
    subtitle: 'Manage shareholder dividends, equity percentage ledgers and payout distribution slips',
    icon: DollarSign,
  },
  {
    id: 'journal-entries',
    label: 'Journal Entries',
    title: 'General Journal & Adjustments',
    subtitle: 'Double-entry general journals, year-end adjustments, accruals and audit ledger trails',
    icon: FileSpreadsheet,
  },
];

// Sample Chart of Accounts matching user interface
const INITIAL_ACCOUNTS = [
  { code: '1000', name: 'Assets', isSystem: true, type: 'asset', parent: '-', balance: 1478173.21, txCount: 0, status: 'active' },
  { code: '1100', name: 'Current Assets', isSystem: true, type: 'asset', parent: 'Assets', balance: 1478173.21, txCount: 0, status: 'active' },
  { code: '1110', name: 'Cash on Hand', isSystem: true, type: 'asset', parent: 'Current Assets', balance: 495707.44, txCount: 103, status: 'active' },
  { code: '1120', name: 'Bank Accounts', isSystem: true, type: 'asset', parent: 'Current Assets', balance: 5546.00, txCount: 3, status: 'active' },
  { code: '1120-123456789-2972', name: 'hi - 123456789', isSystem: false, type: 'asset', parent: 'Bank Accounts', balance: 3445.00, txCount: 3, status: 'active' },
  { code: '1125', name: 'Cheques in Hand', isSystem: true, type: 'asset', parent: 'Current Assets', balance: 407.00, txCount: 10, status: 'active' },
  { code: '1130', name: 'Accounts Receivable', isSystem: true, type: 'asset', parent: 'Current Assets', balance: 73139.31, txCount: 193, status: 'active' },
  { code: '1140', name: 'Inventory', isSystem: true, type: 'asset', parent: 'Current Assets', balance: 902014.86, txCount: 139, status: 'active' },
  { code: '1145', name: 'Inventory in Transit', isSystem: false, type: 'asset', parent: 'Current Assets', balance: 0.00, txCount: 0, status: 'active' },
  { code: '1200', name: 'Non-Current Assets', isSystem: true, type: 'asset', parent: 'Assets', balance: 0.00, txCount: 0, status: 'active' },
  { code: '2000', name: 'Liabilities', isSystem: true, type: 'liability', parent: '-', balance: 245680.00, txCount: 0, status: 'active' },
  { code: '2100', name: 'Accounts Payable', isSystem: true, type: 'liability', parent: 'Liabilities', balance: 184200.00, txCount: 48, status: 'active' },
  { code: '3000', name: 'Equity', isSystem: true, type: 'equity', parent: '-', balance: 1232493.21, txCount: 0, status: 'active' },
  { code: '4000', name: 'Revenue / Sales', isSystem: true, type: 'income', parent: '-', balance: 892100.00, txCount: 210, status: 'active' },
  { code: '5000', name: 'Cost of Goods Sold', isSystem: true, type: 'expense', parent: '-', balance: 510400.00, txCount: 145, status: 'active' },
  { code: '6000', name: 'Operating Expenses', isSystem: true, type: 'expense', parent: '-', balance: 78350.00, txCount: 29, status: 'active' },
];

export default function AccountingHub({ activeSubTab, onSubTabChange }) {
  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && ACCOUNTING_TABS.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return 'chart-of-accounts';
  });

  // Chart of accounts search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    if (activeSubTab && ACCOUNTING_TABS.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const activeTabMeta = useMemo(() => {
    return ACCOUNTING_TABS.find((t) => t.id === currentTab) || ACCOUNTING_TABS[0];
  }, [currentTab]);

  // Filtered Chart of Accounts
  const filteredAccounts = useMemo(() => {
    return INITIAL_ACCOUNTS.filter((acc) => {
      if (!showInactive && acc.status === 'inactive') return false;
      if (typeFilter !== 'ALL' && acc.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = acc.code.toLowerCase().includes(q);
        const matchName = acc.name.toLowerCase().includes(q);
        const matchParent = acc.parent.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchParent) return false;
      }
      return true;
    });
  }, [searchQuery, typeFilter, showInactive]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px',
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* Top Header matching user screenshot */}
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Accounting Management
          </h1>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '9999px',
              padding: '3px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <Clock size={12} />
            {activeTabMeta.title}
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
          {activeTabMeta.subtitle}
        </p>
      </div>

      {/* Pill Navigation Bar matching user screenshot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#ffffff',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '18px',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {ACCOUNTING_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '7px',
                border: 'none',
                backgroundColor: isActive ? '#0284c7' : 'transparent',
                color: isActive ? '#ffffff' : '#475569',
                fontSize: '0.86rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Chart of Accounts UI (matches user mockup with Coming Soon overlay/badge) */}
      {currentTab === 'chart-of-accounts' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          {/* Coming soon notice banner */}
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="#2563eb" style={{ flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.88rem' }}>
                  Chart of Accounts Module Preview — Feature Coming Soon:
                </span>
                <span style={{ color: '#1e3a8a', fontSize: '0.85rem', marginLeft: '6px' }}>
                  Standard GL hierarchy, automated transaction balancing, and custom sub-account tree builder are currently in final development.
                </span>
              </div>
            </div>
            <span
              style={{
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              v2.1 In-Development
            </span>
          </div>

          {/* Search, Filter, and Show Inactive Bar */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '14px 18px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '320px' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
                <Search
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.86rem',
                  color: '#334155',
                  cursor: 'pointer',
                  minWidth: '150px',
                }}
              >
                <option value="ALL">All Types</option>
                <option value="asset">Assets</option>
                <option value="liability">Liabilities</option>
                <option value="equity">Equity</option>
                <option value="income">Income / Revenue</option>
                <option value="expense">Expenses</option>
              </select>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', color: '#475569', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show Inactive
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing <strong>{filteredAccounts.length}</strong> accounts
              </span>
            </div>
          </div>

          {/* Table matching user screenshot */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px' }}>CODE</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px' }}>ACCOUNT NAME</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px' }}>TYPE</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px' }}>PARENT</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px', textAlign: 'right' }}>BALANCE</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px', textAlign: 'center' }}>TRANSACTIONS</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 18px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc, idx) => (
                    <tr
                      key={acc.code}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa')}
                    >
                      <td style={{ padding: '12px 18px', fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                        {acc.code}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{acc.name}</span>
                          {acc.isSystem && (
                            <span
                              style={{
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                              }}
                            >
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span
                          style={{
                            backgroundColor:
                              acc.type === 'asset'
                                ? '#e0f2fe'
                                : acc.type === 'liability'
                                ? '#fee2e2'
                                : acc.type === 'equity'
                                ? '#fef3c7'
                                : acc.type === 'income'
                                ? '#dcfce7'
                                : '#f3e8ff',
                            color:
                              acc.type === 'asset'
                                ? '#0369a1'
                                : acc.type === 'liability'
                                ? '#b91c1c'
                                : acc.type === 'equity'
                                ? '#b45309'
                                : acc.type === 'income'
                                ? '#15803d'
                                : '#7e22ce',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            textTransform: 'lowercase',
                          }}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#64748b' }}>
                        {acc.parent}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', color: '#64748b' }}>
                        {acc.txCount}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAccount(acc)}
                          title="View Account Info (Preview)"
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#0284c7',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No accounts match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Banking Feature Coming Soon */}
      {currentTab === 'banking' && (
        <ComingSoonSection
          title="Banking & Cash Management"
          subtitle="Corporate bank accounts, statement imports, and automated reconciliation"
          icon={Landmark}
          color="#2563eb"
          bg="#eff6ff"
          features={[
            {
              title: 'Multi-Bank Account Registry',
              desc: 'Add and monitor multiple business bank accounts, branch codes, IBAN/SWIFT details and active cash balances.',
            },
            {
              title: 'Bank Statement Auto-Reconciliation',
              desc: 'Import CSV/OFX statements and automatically match ledger transactions with clear discrepancy flags.',
            },
            {
              title: 'Fund Transfers & Internal Vouchers',
              desc: 'Transfer funds between company bank accounts and cash drawers with complete audit verification.',
            },
            {
              title: 'Cash Flow Projection',
              desc: 'Live forecast of incoming receivable deposits versus supplier payouts for cash liquidity management.',
            },
          ]}
        />
      )}

      {/* Tab 3: Cheques Feature Coming Soon */}
      {currentTab === 'cheques' && (
        <ComingSoonSection
          title="Cheque Management & Clearing"
          subtitle="Inward customer cheques, outward supplier cheques, and maturity tracking"
          icon={CreditCard}
          color="#0891b2"
          bg="#ecfeff"
          features={[
            {
              title: 'Inward & Outward Register',
              desc: 'Centralized registry for cheques received from customers and cheques issued to purchase suppliers.',
            },
            {
              title: 'Status Lifecycle Tracking',
              desc: 'Seamless progression tracking: Received → In-Hand → Deposited → Cleared / Bounced / Cancelled.',
            },
            {
              title: 'Post-Dated Cheques (PDC)',
              desc: 'Automated alert dashboard reminding your accounting team of upcoming cheque maturity dates.',
            },
            {
              title: 'Dishonored Cheque Ledger',
              desc: 'Instant reversing journal entries and customer credit notifications when a deposited cheque is returned unpaid.',
            },
          ]}
        />
      )}

      {/* Tab 4: Expenses Feature Coming Soon */}
      {currentTab === 'expenses' && (
        <ComingSoonSection
          title="Operating Expenses & Petty Cash"
          subtitle="Manage administrative overheads, utility bills, employee petty cash and approval logs"
          icon={Receipt}
          color="#d97706"
          bg="#fffbeb"
          features={[
            {
              title: 'Categorized Expense Claims',
              desc: 'Categorize expenses by Utilities, Rent, Logistics, Marketing, Office Supplies, and Maintenance.',
            },
            {
              title: 'Petty Cash Float & Top-Up',
              desc: 'Track daily cash drawer floats, imprest replenishment vouchers, and receipt attachments.',
            },
            {
              title: 'Multi-Level Approval Workflow',
              desc: 'Require supervisor or branch manager sign-off for expense claims exceeding configured thresholds.',
            },
            {
              title: 'Tax Deductible Expense Reports',
              desc: 'Generate monthly VAT/GST expense summaries for corporate tax filing and ledger deduction.',
            },
          ]}
        />
      )}

      {/* Tab 5: Dividend Feature Coming Soon */}
      {currentTab === 'dividend' && (
        <ComingSoonSection
          title="Dividend Distribution & Shareholder Ledger"
          subtitle="Manage shareholder equity, profit distributions, withholding tax and payout vouchers"
          icon={DollarSign}
          color="#059669"
          bg="#ecfdf5"
          features={[
            {
              title: 'Shareholder Equity Registry',
              desc: 'Record partner/shareholder names, identification numbers, share counts, and percentage equity ownership.',
            },
            {
              title: 'Dividend Declaration Engine',
              desc: 'Calculate interim and final dividend distributions directly from audited net profit balances.',
            },
            {
              title: 'Tax Deduction & Payout Slips',
              desc: 'Auto-calculate withholding tax and generate printable dividend vouchers and direct bank transfer schedules.',
            },
            {
              title: 'Retained Earnings Synchronization',
              desc: 'Direct ledger adjustment transferring declared dividends out of retained earnings into shareholder payout accounts.',
            },
          ]}
        />
      )}

      {/* Tab 6: Journal Entries Feature Coming Soon */}
      {currentTab === 'journal-entries' && (
        <ComingSoonSection
          title="General Journal & Adjusting Entries"
          subtitle="Double-entry manual journals, year-end adjustments, accruals and audit trail ledger"
          icon={FileSpreadsheet}
          color="#7c3aed"
          bg="#f5f3ff"
          features={[
            {
              title: 'Double-Entry Validation',
              desc: 'Enforce strict debit/credit equality with line-level account selection, cost centers, and tax codes.',
            },
            {
              title: 'Recurring Journal Templates',
              desc: 'Schedule automated monthly depreciation, prepaid rent amortization, and interest accrual entries.',
            },
            {
              title: 'Year-End Closing Postings',
              desc: 'Automated fiscal year-end profit/loss roll-over into retained earnings with reversible closing entries.',
            },
            {
              title: 'Immutable Audit Trail',
              desc: 'Full change history documenting user timestamp, reason for adjustment, and previous values for regulatory compliance.',
            },
          ]}
        />
      )}

      {/* Account Details Preview Modal */}
      {selectedAccount && (
        <div className="modal-backdrop" onClick={() => setSelectedAccount(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{selectedAccount.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Code: {selectedAccount.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Account Type</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize', color: '#0f172a' }}>{selectedAccount.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Parent Account</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedAccount.parent}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Current Balance</span>
                <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace', fontSize: '1rem' }}>
                  LKR {selectedAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Recorded Transactions</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedAccount.txCount} postings</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1e40af', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Clock size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span>Full drill-down ledger transaction history for this account will be available in the upcoming Accounting release.</span>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedAccount(null)}
                style={{ padding: '8px 20px', fontSize: '0.86rem' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Coming Soon Section for each accounting navigation
function ComingSoonSection({ title, subtitle, icon: Icon, color, bg, features }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Coming Soon Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '40px 32px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: color,
          }}
        />

        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: bg,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
          }}
        >
          <Icon size={32} />
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '9999px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
          <Clock size={13} color="#2563eb" />
          Planned Release v2.1
        </div>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
          {title}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.94rem', maxWidth: '560px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
          {subtitle}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <span
            style={{
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={15} /> Specification Complete
          </span>
          <span
            style={{
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={15} /> UI Staging in Progress
          </span>
        </div>
      </div>

      {/* Planned Feature Capabilities Grid */}
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
          Planned Capabilities in this Module
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {features.map((feat, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={14} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  {feat.title}
                </h4>
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem', lineHeight: '1.5' }}>
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
